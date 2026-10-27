// D5 retail offer normalization and change detection. Pure and deterministic.
import { createHash } from "node:crypto";
import { z } from "zod";
import { currencyCodes } from "@/lib/foot-profile/currencies";
import { publicSourceUrl } from "@/lib/product-data/validation";
import type { Availability, SyncConfig } from "./policy";
import type { fieldPolicy } from "./policy";

const MAX_CENTS = 999_999_999; // 9,999,999.99
const symbols = /^[$€£¥₫]/u;
/** Parses a provider price into integer minor units. Ambiguous or mismatched formats are rejected, never guessed. */
export function parsePrice(raw: unknown, currency: string): number | null {
  if (raw === null || raw === undefined) return null;
  let text: string;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) throw new Error("invalid_price");
    text = String(raw);
  } else if (typeof raw === "string") text = raw.trim();
  else throw new Error("invalid_price");
  const suffix = text.match(/\s+([A-Z]{3})$/);
  if (suffix) { if (suffix[1] !== currency) throw new Error("currency_mismatch"); text = text.slice(0, -suffix[0].length); }
  text = text.replace(symbols, "").trim();
  // Accept 1299.00 or 1,299.00 (comma thousands). Reject 1.299,00 and anything else ambiguous.
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/.test(text)) throw new Error("invalid_price");
  const [whole, fraction = ""] = text.replace(/,/g, "").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_CENTS) throw new Error("invalid_price");
  return cents;
}
export const formatCents = (cents: number) => `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;

const aliases: Record<string, Availability> = {
  "in stock": "IN_STOCK", instock: "IN_STOCK", in_stock: "IN_STOCK", available: "IN_STOCK",
  "out of stock": "OUT_OF_STOCK", outofstock: "OUT_OF_STOCK", out_of_stock: "OUT_OF_STOCK", "sold out": "OUT_OF_STOCK", soldout: "OUT_OF_STOCK", unavailable: "OUT_OF_STOCK",
  preorder: "PREORDER", "pre-order": "PREORDER", pre_order: "PREORDER", "pre order": "PREORDER",
  discontinued: "DISCONTINUED", "no longer available": "DISCONTINUED",
};
/** null = the feed carried no stock signal (state is kept). Unrecognized labels become UNKNOWN, never OUT_OF_STOCK. */
export function mapAvailability(label: string | null | undefined, custom: Record<string, Availability>) {
  if (label === null || label === undefined || !label.trim()) return null;
  const key = label.trim().toLowerCase().replace(/\s+/g, " ");
  const state = custom[key] ?? aliases[key];
  return state ? { state, known: true } : { state: "UNKNOWN" as const, known: false };
}

export const offerRecord = z.object({
  kind: z.literal("offer"),
  recordId: z.string().trim().min(1).max(120),
  listingId: z.string().trim().min(1).max(120).regex(/^[\w.:-]+$/).optional(),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  currency: z.enum(currencyCodes),
  price: z.union([z.string().max(40), z.number()]).nullable().optional(),
  availability: z.string().max(60).nullable().optional(),
  size: z.string().regex(/^\d{1,2}(\.\d{1,2})?$/).nullable().optional(),
  sizeSystem: z.enum(["UK", "US", "EU", "CM"]).nullable().optional(),
  sourceUrl: publicSourceUrl,
  observedAt: z.iso.datetime({ offset: true }).refine(v => Date.parse(v) <= Date.now() + 60_000, "Observation is in the future."),
  status: z.enum(["ACTIVE", "DELISTED"]).default("ACTIVE"),
}).strict().refine(v => (v.size ?? null) === null ? (v.sizeSystem ?? null) === null : (v.sizeSystem ?? null) !== null, "Size and size system must be provided together.");

export function listingKey(o: { recordId: string; listingId?: string; countryCode: string; size: string | null; sizeSystem: string | null }) {
  if (o.listingId) return `id:${o.listingId}`;
  return "k:" + createHash("sha256").update(JSON.stringify([o.recordId, o.countryCode, o.size, o.sizeSystem])).digest("hex").slice(0, 40);
}

export function normalizeOffer(raw: unknown, policy: ReturnType<typeof fieldPolicy>) {
  const o = offerRecord.parse(raw);
  const size = o.size ?? null, sizeSystem = o.sizeSystem ?? null;
  // OFF means the source is not used for that field at all: no value and no "missing" signal.
  const priceIgnored = policy.prices === "OFF";
  const availability = policy.availability === "OFF" ? null : mapAvailability(o.availability, policy.availabilityLabels);
  return { priceIgnored,
    recordId: o.recordId, listingKey: listingKey({ ...o, size, sizeSystem }), countryCode: o.countryCode, size, sizeSystem,
    currency: o.currency, amountCents: priceIgnored ? null : parsePrice(o.price, o.currency), availability: availability?.state ?? null, availabilityKnown: availability?.known ?? true,
    rawAvailability: o.availability?.trim().slice(0, 60) ?? null, sourceUrl: new URL(o.sourceUrl).href, observedAt: new Date(o.observedAt), delisted: o.status === "DELISTED",
  };
}
export type IncomingOffer = ReturnType<typeof normalizeOffer>;
export type OfferState = { status: string; currency: string | null; amountCents: number | null; availability: Availability; lastObservedAt: Date; priceMissingSince: Date | null; lastEvidenceAt: Date | null };
export type OfferChange = "INITIAL" | "PRICE_INCREASE" | "PRICE_DECREASE" | "CURRENCY_CHANGE" | "AVAILABILITY" | "PRICE_AND_AVAILABILITY" | "REFRESH" | "PRICE_MISSING" | "REMOVED";
type Next = { status: "ACTIVE" | "REMOVED"; currency: string | null; amountCents: number | null; previousCents: number | null; previousCurrency: string | null; availability: Availability; priceMissingSince: Date | null };

/**
 * Compares one incoming listing with its stored state.
 * change=null means only freshness (lastObservedAt) moves; no history row is written.
 */
export function diffOffer(existing: OfferState | null, incoming: IncomingOffer, now: Date, config: SyncConfig): { action: "CREATE" | "UPDATE" | "SKIP"; change: OfferChange | null; next: Next | null } {
  if (!existing) {
    if (incoming.delisted) return { action: "SKIP", change: null, next: null };
    const missing = incoming.amountCents === null && !incoming.priceIgnored;
    return { action: "CREATE", change: missing ? "PRICE_MISSING" : "INITIAL", next: { status: "ACTIVE", currency: incoming.amountCents === null ? null : incoming.currency, amountCents: incoming.amountCents, previousCents: null, previousCurrency: null, availability: incoming.availability ?? "UNKNOWN", priceMissingSince: missing ? incoming.observedAt : null } };
  }
  // Out-of-order or replayed observations never roll state backwards.
  if (incoming.observedAt < existing.lastObservedAt) return { action: "SKIP", change: null, next: null };
  const keep = { previousCents: null as number | null, previousCurrency: null as string | null };
  if (incoming.delisted) {
    if (existing.status === "REMOVED") return { action: "UPDATE", change: null, next: null };
    return { action: "UPDATE", change: "REMOVED", next: { status: "REMOVED", currency: existing.currency, amountCents: existing.amountCents, ...keep, availability: existing.availability, priceMissingSince: existing.priceMissingSince } };
  }
  const availability = incoming.availability ?? existing.availability;
  const availabilityChanged = availability !== existing.availability;
  let priceChange: OfferChange | null = null, amountCents = existing.amountCents, currency = existing.currency, priceMissingSince: Date | null = null;
  if (incoming.priceIgnored) {
    priceMissingSince = existing.priceMissingSince;
  } else if (incoming.amountCents === null) {
    // Keep the last observed price; record the gap once.
    priceMissingSince = existing.priceMissingSince ?? incoming.observedAt;
    if (!existing.priceMissingSince) priceChange = "PRICE_MISSING";
  } else if (existing.currency !== incoming.currency || existing.amountCents === null) {
    priceChange = existing.amountCents === null ? "INITIAL" : "CURRENCY_CHANGE";
    if (existing.amountCents !== null) { keep.previousCents = existing.amountCents; keep.previousCurrency = existing.currency; }
    amountCents = incoming.amountCents; currency = incoming.currency;
  } else if (existing.amountCents !== incoming.amountCents) {
    priceChange = incoming.amountCents > existing.amountCents ? "PRICE_INCREASE" : "PRICE_DECREASE";
    keep.previousCents = existing.amountCents; keep.previousCurrency = existing.currency; amountCents = incoming.amountCents;
  }
  const next: Next = { status: "ACTIVE", currency, amountCents, ...keep, availability, priceMissingSince };
  let change: OfferChange | null = priceChange && availabilityChanged && priceChange !== "PRICE_MISSING" ? "PRICE_AND_AVAILABILITY" : priceChange ?? (availabilityChanged ? "AVAILABILITY" : null);
  if (existing.status === "REMOVED" && !change) change = "INITIAL"; // relisted
  // Only re-confirm a price the source is reporting right now.
  if (!change && incoming.amountCents !== null && (!existing.lastEvidenceAt || now.getTime() - existing.lastEvidenceAt.getTime() >= config.priceRefreshHours * 3_600_000)) change = "REFRESH";
  return { action: "UPDATE", change, next };
}

/** Public price evidence is only emitted under an AUTO price policy, for a known positive price. */
export function publishesPrice(change: OfferChange | null, amountCents: number | null, policy: ReturnType<typeof fieldPolicy>) {
  return policy.prices === "AUTO" && amountCents !== null && change !== null && ["INITIAL", "PRICE_INCREASE", "PRICE_DECREASE", "CURRENCY_CHANGE", "PRICE_AND_AVAILABILITY", "REFRESH"].includes(change);
}
