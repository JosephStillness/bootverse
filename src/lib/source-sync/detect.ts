// D5 change detection over a D2 import plan. Pure: identity resolution stays in D2 (prepareImport).
import { createHash } from "node:crypto";
import { compareClaims, isExplicitUnknown } from "@/lib/product-data/comparison";
import { stableJson, type PreparedImport } from "@/lib/data-import/preview";
import { classifyChange, type ChangeKind, type SyncConfig } from "./policy";

export type SyncOutcome = "NEW_PRODUCT" | "EXISTING_PRODUCT" | "POSSIBLE_DUPLICATE" | "IDENTITY_CONFLICT" | "INSUFFICIENT_INFORMATION";
export type ExistingEntry = {
  surface: string | null;
  identifiers: { value: string; region: string }[];
  claims: { id: string; attribute: string; value: unknown; status: string; sourceId: string }[];
  images: { id: string; externalUrl: string | null; sourceId: string; publicEligible: boolean }[];
};
export type DetectedChange = { recordId: string; entryId: string | null; outcome: SyncOutcome; kind: ChangeKind; severity: string; disposition: string; attribute: string | null; previousValue: unknown; proposedValue: unknown; changeKey: string };
type Spec = { attribute: string; value: unknown; basis: string; notes: string | null };

const safetyAttributes = new Set(["surfaceDesignation", "playingSurfaceGuidance"]);
// A spec-only disagreement still identifies the exact product; identity disagreements never do.
const identityDiagnostics = ["existing_identity_changed", "source_sku_disagreement", "contradictory_file_identifier", "manufacturer_or_brand_conflict"];

export function changeKey(sourceId: string, recordId: string, entryId: string | null, kind: string, attribute: string | null, proposed: unknown) {
  return createHash("sha256").update(stableJson(["d5", sourceId, recordId, entryId, kind, attribute, proposed ?? null])).digest("hex");
}

export function outcomeOf(row: PreparedImport["rows"][number]): SyncOutcome | "INVALID" {
  if (row.outcome === "NEW_RECORD") return "NEW_PRODUCT";
  if (row.outcome === "EXACT_MATCH") return "EXISTING_PRODUCT";
  if (row.outcome === "POSSIBLE_MATCH") return "POSSIBLE_DUPLICATE";
  if (row.outcome === "CONFLICT") return row.entryId && row.diagnostics.includes("verified_attribute_conflict") && !row.diagnostics.some(d => identityDiagnostics.includes(d)) ? "EXISTING_PRODUCT" : "IDENTITY_CONFLICT";
  if (row.outcome === "INSUFFICIENT_IDENTITY") return "INSUFFICIENT_INFORMATION";
  return "INVALID";
}

export function detectChanges(input: { sourceId: string; complete: boolean; plan: PreparedImport; existing: Map<string, ExistingEntry>; recordUrls: Map<string, string>; config: SyncConfig }) {
  const { sourceId, plan, config } = input;
  const changes: DetectedChange[] = [];
  const enrichmentRows: { row: number; entryId: string; variantId: string; sourceUrl: string; observedAt: string; specifications: Spec[]; images: Record<string, unknown>[] }[] = [];
  const outcomes: Record<string, number> = {};
  const unchanged: number[] = [];
  const add = (recordId: string, entryId: string | null, outcome: SyncOutcome, kind: ChangeKind, attribute: string | null, previousValue: unknown, proposedValue: unknown) => {
    const { severity, disposition } = classifyChange(kind, config);
    changes.push({ recordId, entryId, outcome, kind, severity, disposition, attribute, previousValue: previousValue ?? null, proposedValue: proposedValue ?? null, changeKey: changeKey(sourceId, recordId, entryId, kind, attribute, proposedValue) });
  };
  const inserted = { brands: new Set(plan.inserts.brands.map(x => x.id)), families: new Map(plan.inserts.families.map(x => [x.id, x])), generations: new Map(plan.inserts.generations.map(x => [x.id, x])), tiers: new Set(plan.inserts.tiers.map(x => x.id)), variants: new Map(plan.inserts.variants.map(x => [x.id, x])), colorways: new Set(plan.inserts.colorways.map(x => x.id)), entries: new Map(plan.inserts.entries.map(x => [x.id, x])) };
  // Which identity levels a new record introduces, walking the inserted tier → generation → family → brand chain.
  const newParts = (entryId: string | null, sku: string | null) => {
    const entry = entryId ? inserted.entries.get(entryId) : undefined, variant = entry && inserted.variants.get(entry.outsoleVariantId);
    const generation = variant && inserted.generations.get(variant.generationId), family = generation && inserted.families.get(generation.familyId);
    return { brand: !!family && inserted.brands.has(family.brandId), family: !!family, generation: !!generation, tier: !!variant && inserted.tiers.has(variant.tierModelId), outsoleVariant: !!variant, colorway: !!entry && inserted.colorways.has(entry.colorwayId), sku: !!sku };
  };

  for (const row of plan.rows) {
    const outcome = outcomeOf(row);
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
    if (outcome === "INVALID") continue;
    const r = row.data, recordId = row.recordId ?? `row-${row.row}`;
    if (outcome === "NEW_PRODUCT") {
      add(recordId, row.entryId, outcome, "NEW_PRODUCT", null, null, r && { identity: [r.brand, r.family, r.generation, r.tier, r.outsole ?? "Unknown outsole", r.colorway].join(" · "), sku: r.sku, newParts: newParts(row.entryId, r.sku) });
      continue;
    }
    if (outcome !== "EXISTING_PRODUCT") {
      add(recordId, row.entryId, outcome, outcome === "INSUFFICIENT_INFORMATION" ? "INSUFFICIENT_INFORMATION" : outcome, null, null, { diagnostics: row.diagnostics.slice(0, 10), identity: r ? [r.brand, r.family, r.generation, r.tier, r.outsole ?? "Unknown outsole", r.colorway].join(" · ") : null });
      continue;
    }
    const existing = input.existing.get(row.entryId!);
    if (!r || !existing || !row.variantId) continue;
    const before = changes.length;
    const specs: Spec[] = [];
    for (const s of r.specifications) {
      if (isExplicitUnknown(s.value)) continue; // explicit unknowns establish nothing
      const same = existing.claims.filter(c => c.attribute === s.attribute);
      // Re-observing a value this source already reported (any status, including rejected) is not a change.
      if (same.some(c => c.sourceId === sourceId && compareClaims(s.attribute, c.value, s.value) === "EQUIVALENT")) continue;
      const live = same.filter(c => c.status !== "REJECTED"), verified = live.filter(c => c.status === "VERIFIED");
      const previous = verified.length ? verified.map(c => c.value) : null;
      let kind: ChangeKind;
      if (s.attribute === "normalizedOutsoleCategory" && existing.surface && s.value !== existing.surface) kind = "OUTSOLE_CHANGE";
      else if (verified.some(c => compareClaims(s.attribute, c.value, s.value) === "EQUIVALENT")) kind = "SPEC_CORROBORATION";
      else if (live.some(c => compareClaims(s.attribute, c.value, s.value) === "CONFLICT")) kind = safetyAttributes.has(s.attribute) ? "SAFETY_SPEC_CHANGE" : "SPEC_CONTRADICTION";
      else kind = "SPEC_NEW_VALUE";
      add(recordId, row.entryId, outcome, kind, s.attribute, previous ?? (s.attribute === "normalizedOutsoleCategory" ? existing.surface : null), s.value);
      specs.push(s);
    }
    const urls = new Set(r.images.flatMap(i => i.externalUrl ? [i.externalUrl] : []));
    const images = r.images.filter(i => i.externalUrl && !existing.images.some(e => e.externalUrl === i.externalUrl)).map(({ sourceId: ignored, ...image }) => { void ignored; return image; });
    for (const image of images) add(recordId, row.entryId, outcome, "IMAGE_ADDED", "image", null, { externalUrl: image.externalUrl, attribution: image.attribution });
    // Absence only means removal when the source declares a complete snapshot. Nothing is deleted.
    if (input.complete) for (const e of existing.images) if (e.sourceId === sourceId && e.externalUrl && !urls.has(e.externalUrl)) add(recordId, row.entryId, outcome, e.publicEligible ? "IMAGE_REMOVED" : "IMAGE_REMOVED_NONPUBLIC", "image", { id: e.id, externalUrl: e.externalUrl }, null);
    if (r.sku && !existing.identifiers.some(i => i.value === r.sku && i.region === r.skuRegion)) add(recordId, row.entryId, outcome, "SKU_CHANGE", "sku", existing.identifiers.map(i => `${i.region}:${i.value}`), `${r.skuRegion}:${r.sku}`);
    const previousUrl = input.recordUrls.get(recordId);
    if (previousUrl && previousUrl !== r.sourceUrl) add(recordId, row.entryId, outcome, "SOURCE_METADATA", "sourceUrl", previousUrl, r.sourceUrl);
    if (specs.length || images.length) enrichmentRows.push({ row: row.row, entryId: row.entryId!, variantId: row.variantId, sourceUrl: r.sourceUrl, observedAt: r.observedAt, specifications: specs, images });
    if (changes.length === before) unchanged.push(row.row);
  }
  return { changes, enrichmentRows, outcomes, unchanged };
}
