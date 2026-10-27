import { describe, expect, it } from "vitest";
import { diffOffer, listingKey, mapAvailability, normalizeOffer, parsePrice, type OfferState } from "./offers";
import { fieldPolicy, syncConfig } from "./policy";

// Synthetic retail fixtures only.
const config = syncConfig({});
const base = { kind: "offer", recordId: "rec-1", countryCode: "AU", currency: "AUD", price: "199.95", availability: "In stock", sourceUrl: "https://example.test/offer/1", observedAt: "2026-10-26T10:00:00Z" };
const at = (iso: string) => new Date(iso);
const state = (over: Partial<OfferState> = {}): OfferState => ({ status: "ACTIVE", currency: "AUD", amountCents: 19995, availability: "IN_STOCK", lastObservedAt: at("2026-10-25T10:00:00Z"), priceMissingSince: null, lastEvidenceAt: at("2026-10-25T10:00:00Z"), ...over });
const incoming = (over: Record<string, unknown> = {}) => normalizeOffer({ ...base, ...over }, fieldPolicy({}));

describe("D5 price parsing", () => {
  it.each([["199.95", 19995], [199.95, 19995], ["1,299.00", 129900], ["$120", 12000], ["120 AUD", 12000], ["  120.5 ", 12050]])("parses %s", (raw, cents) => expect(parsePrice(raw, "AUD")).toBe(cents));
  it.each([["-5"], [0], ["12.345"], ["1.299,00"], ["120 USD"], ["free"], [Number.NaN], ["99999999"]])("rejects invalid price %s", raw => expect(() => parsePrice(raw, "AUD")).toThrow());
  it("treats an absent price as missing, not zero", () => expect(parsePrice(null, "AUD")).toBeNull());
});

describe("D5 availability mapping", () => {
  it("maps known provider labels and source-specific aliases", () => {
    expect(mapAvailability("IN STOCK", {})).toEqual({ state: "IN_STOCK", known: true });
    expect(mapAvailability("Sold out", {})).toEqual({ state: "OUT_OF_STOCK", known: true });
    expect(mapAvailability("pre-order", {})).toEqual({ state: "PREORDER", known: true });
    expect(mapAvailability("Ships soon", { "ships soon": "PREORDER" })).toEqual({ state: "PREORDER", known: true });
  });
  it("never turns missing or unrecognized stock data into OUT_OF_STOCK", () => {
    expect(mapAvailability(null, {})).toBeNull();
    expect(mapAvailability("Check store", {})).toEqual({ state: "UNKNOWN", known: false });
  });
});

describe("D5 offer identity", () => {
  it("never infers across country or size", () => {
    expect(listingKey({ recordId: "r", countryCode: "AU", size: null, sizeSystem: null })).not.toBe(listingKey({ recordId: "r", countryCode: "NZ", size: null, sizeSystem: null }));
    expect(listingKey({ recordId: "r", countryCode: "AU", size: "9", sizeSystem: "UK" })).not.toBe(listingKey({ recordId: "r", countryCode: "AU", size: "9", sizeSystem: "US" }));
    expect(listingKey({ recordId: "r", listingId: "L1", countryCode: "AU", size: null, sizeSystem: null })).toBe("id:L1");
  });
  it("requires a country and paired size context", () => {
    expect(() => incoming({ countryCode: undefined })).toThrow();
    expect(() => incoming({ size: "9" })).toThrow();
  });
});

describe("D5 offer change detection", () => {
  const now = at("2026-10-26T10:05:00Z");
  it("creates a new listing", () => expect(diffOffer(null, incoming(), now, config).change).toBe("INITIAL"));
  it("detects increases and decreases in the same currency", () => {
    expect(diffOffer(state(), incoming({ price: "219.95" }), now, config)).toMatchObject({ change: "PRICE_INCREASE", next: { amountCents: 21995, previousCents: 19995 } });
    expect(diffOffer(state(), incoming({ price: "179.95" }), now, config).change).toBe("PRICE_DECREASE");
  });
  it("ignores formatting-only differences", () => expect(diffOffer(state({ lastEvidenceAt: at("2026-10-26T09:00:00Z") }), incoming({ price: "$199.95" }), now, config).change).toBeNull());
  it("never compares prices across currencies", () => expect(diffOffer(state(), incoming({ currency: "NZD", price: "150" }), now, config)).toMatchObject({ change: "CURRENCY_CHANGE", next: { previousCents: 19995, previousCurrency: "AUD" } }));
  it("records availability changes and keeps price", () => expect(diffOffer(state(), incoming({ availability: "Sold out" }), now, config)).toMatchObject({ change: "AVAILABILITY", next: { availability: "OUT_OF_STOCK", amountCents: 19995 } }));
  it("keeps the last price when a price is missing and keeps stock when the signal is absent", () => {
    const r = diffOffer(state(), incoming({ price: null, availability: null }), now, config);
    expect(r.change).toBe("PRICE_MISSING"); expect(r.next).toMatchObject({ amountCents: 19995, availability: "IN_STOCK" });
    expect(diffOffer(state({ priceMissingSince: at("2026-10-25T00:00:00Z") }), incoming({ price: null }), now, config).change).toBeNull();
  });
  it("refreshes public evidence only after the refresh window", () => {
    expect(diffOffer(state({ lastEvidenceAt: at("2026-10-26T09:00:00Z") }), incoming(), now, config).change).toBeNull();
    expect(diffOffer(state({ lastEvidenceAt: at("2026-10-24T09:00:00Z") }), incoming(), now, config).change).toBe("REFRESH");
  });
  it("removes a listing only on an explicit delisting", () => {
    expect(diffOffer(state(), incoming({ status: "DELISTED" }), now, config)).toMatchObject({ change: "REMOVED", next: { status: "REMOVED" } });
    expect(diffOffer(null, incoming({ status: "DELISTED" }), now, config).action).toBe("SKIP");
  });
  it("ignores a field the source policy turns OFF without recording it as missing", () => {
    const off = normalizeOffer({ ...base, price: null, availability: "Sold out" }, fieldPolicy({ prices: "OFF", availability: "OFF" }));
    expect(off).toMatchObject({ priceIgnored: true, amountCents: null, availability: null });
    expect(diffOffer(state({ lastEvidenceAt: at("2026-10-26T09:00:00Z") }), off, now, config)).toMatchObject({ change: null, next: { amountCents: 19995, availability: "IN_STOCK" } });
  });
  it("ignores replayed older observations", () => expect(diffOffer(state({ lastObservedAt: at("2026-10-27T00:00:00Z") }), incoming(), now, config).action).toBe("SKIP"));
});
