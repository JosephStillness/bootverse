import { describe, expect, it } from "vitest";
import { emptyGraph, prepareImport, type PreparedImport, type Graph } from "@/lib/data-import/preview";
import { detectChanges, type ExistingEntry } from "./detect";
import { syncConfig } from "./policy";

// Synthetic records only; no real product, SKU or specification.
const source = { id: "src", name: "Synthetic feed", type: "PRODUCT_FEED", version: 1, brandId: null };
const product = { recordId: "rec-1", brand: "Synthetic D5 brand", family: "Synthetic family", generation: "Gen 1", tier: "Elite", outsole: "FG", colorway: "Synthetic blue", sku: "SYN-D5-1", sourceUrl: "https://example.test/p/1", observedAt: "2026-10-20T00:00:00Z" };
const plan = (products: unknown[], graph: Graph = emptyGraph()) => prepareImport({ sourceId: "src", format: "JSON", content: JSON.stringify({ version: 1, products }), mapping: {} }, source, graph);
const graphFrom = (p: PreparedImport): Graph => ({ ...emptyGraph(), ...p.inserts, sourceRecords: p.inserts.sourceRecords });
const config = syncConfig({});
const existing = (entryId: string, over: Partial<ExistingEntry> = {}) => new Map([[entryId, { surface: "FG", identifiers: [{ value: "SYN-D5-1", region: "UNSPECIFIED" }], claims: [], images: [], ...over }]]);
const run = (p: PreparedImport, map = new Map<string, ExistingEntry>(), complete = false, recordUrls = new Map<string, string>()) => detectChanges({ sourceId: "src", complete, plan: p, existing: map, recordUrls, config });

describe("D5 new product detection", () => {
  it("reports a new product with every new identity level, created only as a draft", () => {
    const p = plan([product]), d = run(p);
    expect(d.changes).toHaveLength(1);
    expect(d.changes[0]).toMatchObject({ outcome: "NEW_PRODUCT", kind: "NEW_PRODUCT", disposition: "PENDING_REVIEW", proposedValue: { newParts: { brand: true, family: true, generation: true, tier: true, outsoleVariant: true, colorway: true, sku: true } } });
    expect(p.inserts.entries.every(e => e.status === "DRAFT")).toBe(true);
  });
  const first = plan([product]), graph = graphFrom(first), entryId = first.inserts.entries[0].id;
  it("recognizes the existing exact product and reports nothing when only the timestamp changed", () => {
    const d = run(plan([{ ...product, observedAt: "2026-10-26T00:00:00Z" }], graph), existing(entryId));
    expect(d.outcomes).toEqual({ EXISTING_PRODUCT: 1 }); expect(d.changes).toEqual([]); expect(d.unchanged).toEqual([1]);
  });
  it("detects a new tier and a new outsole as separate new products, never merged", () => {
    const d = run(plan([{ ...product, recordId: "rec-pro", sku: "SYN-D5-PRO", tier: "Pro" }, { ...product, recordId: "rec-ag", sku: "SYN-D5-AG", outsole: "AG" }], graph));
    expect(d.changes.map(c => c.outcome)).toEqual(["NEW_PRODUCT", "NEW_PRODUCT"]);
    expect(d.changes[0].proposedValue).toMatchObject({ newParts: { brand: false, tier: true } });
    expect(d.changes[1].proposedValue).toMatchObject({ newParts: { tier: false, outsoleVariant: true } });
  });
  it("flags a same-name record without a SKU as a possible duplicate", () => {
    expect(run(plan([{ ...product, recordId: "rec-dup", sku: null }], graph)).changes[0]).toMatchObject({ outcome: "POSSIBLE_DUPLICATE", severity: "MATERIAL" });
  });
  it("treats a changed tier on a known record as a critical identity conflict", () => {
    expect(run(plan([{ ...product, tier: "Pro" }], graph)).changes[0]).toMatchObject({ outcome: "IDENTITY_CONFLICT", severity: "CRITICAL", disposition: "PENDING_REVIEW" });
  });
  it("reports a SKU correction on a mapped record as critical, without applying it", () => {
    expect(run(plan([{ ...product, sku: "SYN-D5-1B" }], graph), existing(entryId)).changes[0]).toMatchObject({ kind: "SKU_CHANGE", severity: "CRITICAL", previousValue: ["UNSPECIFIED:SYN-D5-1"], proposedValue: "UNSPECIFIED:SYN-D5-1B" });
  });
  it("flags records that lack required identity as insufficient information", () => {
    const d = run(plan([{ ...product, recordId: "rec-x", tier: undefined }]));
    expect(d.outcomes).toEqual({ INSUFFICIENT_INFORMATION: 1 });
  });
});

describe("D5 specification and image change detection", () => {
  const first = plan([product]), graph = graphFrom(first), entryId = first.inserts.entries[0].id;
  const verified = (attribute: string, value: unknown, sourceId = "other") => ({ id: `c-${attribute}`, attribute, value, status: "VERIFIED", sourceId });
  const withSpecs = (specifications: unknown[], over: Partial<ExistingEntry> = {}) => run(plan([{ ...product, specifications }], graph), existing(entryId, over));
  it("ignores formatting-only differences and values this source already reported", () => {
    expect(withSpecs([{ attribute: "upperMaterial", value: "  synthetic   knit ", basis: "REPORTED" }], { claims: [{ ...verified("upperMaterial", "Synthetic knit"), sourceId: "src" }] }).changes).toEqual([]);
  });
  it("records corroboration from a new source as routine", () => {
    expect(withSpecs([{ attribute: "upperMaterial", value: "Synthetic KNIT", basis: "REPORTED" }], { claims: [verified("upperMaterial", "Synthetic knit")] }).changes[0]).toMatchObject({ kind: "SPEC_CORROBORATION", severity: "ROUTINE", disposition: "RECORDED" });
  });
  it("routes a contradiction of verified evidence to review and keeps the previous value", () => {
    expect(withSpecs([{ attribute: "upperMaterial", value: "Synthetic leather", basis: "REPORTED" }], { claims: [verified("upperMaterial", "Synthetic knit")] }).changes[0]).toMatchObject({ kind: "SPEC_CONTRADICTION", severity: "MATERIAL", previousValue: ["Synthetic knit"], proposedValue: "Synthetic leather" });
  });
  it("treats outsole and playing-surface contradictions as critical", () => {
    expect(withSpecs([{ attribute: "normalizedOutsoleCategory", value: "AG", basis: "REPORTED" }]).changes[0]).toMatchObject({ kind: "OUTSOLE_CHANGE", severity: "CRITICAL", previousValue: "FG" });
    expect(withSpecs([{ attribute: "surfaceDesignation", value: "Synthetic AG", basis: "REPORTED" }], { claims: [verified("surfaceDesignation", "Synthetic FG")] }).changes[0].kind).toBe("SAFETY_SPEC_CHANGE");
  });
  it("does not call weights from different sizes a contradiction", () => {
    const c = withSpecs([{ attribute: "weight", value: { amount: 205, unit: "g", size: "9", sizeSystem: "UK" }, basis: "REPORTED" }], { claims: [verified("weight", { amount: 190, unit: "g", size: "8", sizeSystem: "UK" })] }).changes[0];
    expect(c.kind).toBe("SPEC_NEW_VALUE");
  });
  it("detects new image references and treats grams/ounces equivalently", () => {
    expect(withSpecs([{ attribute: "weight", value: { amount: 10, unit: "oz", size: "9", sizeSystem: "UK" }, basis: "REPORTED" }], { claims: [{ ...verified("weight", { amount: 283.49523125, unit: "g", size: "9", sizeSystem: "UK" }), sourceId: "src" }] }).changes).toEqual([]);
    const image = { externalUrl: "https://example.test/i/new.webp", sourceUrl: "https://example.test/p/1", altText: "Synthetic", attribution: "Synthetic" };
    expect(run(plan([{ ...product, images: [image] }], graph), existing(entryId)).changes[0]).toMatchObject({ kind: "IMAGE_ADDED", severity: "MATERIAL" });
  });
  it("reports image removal only for complete snapshots and never deletes", () => {
    const images = [{ id: "img", externalUrl: "https://example.test/i/old.webp", sourceId: "src", publicEligible: true }];
    expect(run(plan([product], graph), existing(entryId, { images }), false).changes).toEqual([]);
    expect(run(plan([product], graph), existing(entryId, { images }), true).changes[0]).toMatchObject({ kind: "IMAGE_REMOVED", severity: "MATERIAL", previousValue: { id: "img" } });
  });
  it("produces stable keys so repeated detection is deduplicated", () => {
    const a = withSpecs([{ attribute: "upperMaterial", value: "Synthetic leather", basis: "REPORTED" }]).changes[0];
    const b = run(plan([{ ...product, observedAt: "2026-10-27T00:00:00Z", specifications: [{ attribute: "upperMaterial", value: "Synthetic leather", basis: "REPORTED" }] }], graph), existing(entryId)).changes[0];
    expect(a.changeKey).toBe(b.changeKey);
  });
});
