import { describe, expect, it } from "vitest";
import { sourceSchema, claimSchema, identifierSchema, productImageSchema, productDraftSchema, brandSchema, canTransitionClaim, canTransitionProduct, assessProduct } from "./validation";

const source = { name: "Synthetic research source", type: "MANUAL_RESEARCH", baseUrl: "https://example.test", accessMethod: "Manual research" };
const claim = { entryId: "synthetic-entry", sourceId: "synthetic-source", sourceUrl: "https://example.test/spec", attribute: "upperMaterial", value: "Synthetic fixture only", observedAt: "2026-10-01T00:00:00Z", basis: "REPORTED" };
describe("D1 source and evidence contracts", () => {
  it("keeps unknown authorization explicit and rejects undocumented permission", () => {
    expect(sourceSchema.parse(source).authorizationStatus).toBe("UNKNOWN");
    expect(sourceSchema.safeParse({ ...source, authorizationStatus: "GRANTED" }).success).toBe(false);
    expect(sourceSchema.safeParse({ ...source, authorizationStatus: "GRANTED", permissionNotes: "Synthetic written permission only", permissionUrl: "https://example.test/license" }).success).toBe(true);
  });
  it.each(["javascript:alert(1)", "http://example.test", "https://secret@example.test", "https://example.test?api_key=private", "https://127.0.0.1/internal"])("rejects unsafe source URL %s", baseUrl => {
    expect(sourceSchema.safeParse({ ...source, baseUrl }).success).toBe(false);
  });
  it("rejects credential fields and forged verification", () => {
    expect(sourceSchema.safeParse({ ...source, apiKey: "do-not-store" }).success).toBe(false);
    expect(claimSchema.safeParse({ ...claim, status: "VERIFIED" }).success).toBe(false);
  });
  it("requires exactly one evidence target and records weight context", () => {
    expect(claimSchema.safeParse(claim).success).toBe(true);
    expect(claimSchema.safeParse({ ...claim, variantId: "v" }).success).toBe(false);
    expect(claimSchema.safeParse({ ...claim, entryId: undefined }).success).toBe(false);
    expect(claimSchema.safeParse({ ...claim, attribute: "weight", value: 200 }).success).toBe(false);
    expect(claimSchema.safeParse({ ...claim, attribute: "weight", basis: "MEASURED", value: { amount: 200, unit: "g", size: "9", sizeSystem: "UK", method: "Synthetic measurement fixture" } }).success).toBe(true);
    expect(claimSchema.safeParse({ ...claim, attribute: "weight", value: { amount: -1, unit: "g", size: "9", sizeSystem: "UK" } }).success).toBe(false);
  });
  it("requires source review before verification and conflict re-review", () => {
    expect(canTransitionClaim("UNVERIFIED", "VERIFIED")).toBe(false);
    expect(canTransitionClaim("UNVERIFIED", "PENDING_REVIEW")).toBe(true);
    expect(canTransitionClaim("PENDING_REVIEW", "VERIFIED")).toBe(true);
    expect(canTransitionClaim("VERIFIED", "CONFLICTED")).toBe(true);
    expect(canTransitionClaim("CONFLICTED", "VERIFIED")).toBe(false);
  });
});
describe("D1 identity and publication", () => {
  it("preserves manufacturer SKU case and distinguishes unknown, global and regional scope", () => {
    const a = identifierSchema.parse({ value: "  Synthetic-AbC  ", sourceId: "s", sourceUrl: "https://example.test/sku" });
    expect(a.value).toBe("Synthetic-AbC"); expect(a.region).toBe("UNSPECIFIED");
    expect(identifierSchema.parse({ ...a, region: "GLOBAL" }).region).toBe("GLOBAL");
    expect(identifierSchema.safeParse({ ...a, region: "Viet Nam" }).success).toBe(false);
  });
  it("requires stable identity fields but no invented optional specs", () => {
    const draft = { slug: "synthetic-entry", variantId: "v", colorwayId: "c", sourceId: "s" };
    expect(productDraftSchema.safeParse(draft).success).toBe(true);
    expect(productDraftSchema.safeParse({ ...draft, variantId: "" }).success).toBe(false);
    expect(productDraftSchema.safeParse({ ...draft, published: true }).success).toBe(false);
    expect(brandSchema.safeParse({ name: "Synthetic brand", slug: "synthetic-brand" }).success).toBe(true);
  });
  it("accepts permission-backed image metadata with exactly one location", () => {
    const image = { sourceId: "s", sourceUrl: "https://example.test/photo", externalUrl: "https://example.test/photo.webp", altText: "Synthetic photo fixture", attribution: "Synthetic owner", permissionNotes: "Synthetic written image permission", permissionUrl: "https://example.test/license", licenseStatus: "GRANTED" };
    expect(productImageSchema.safeParse(image).success).toBe(true);
    expect(productImageSchema.safeParse({ ...image, uploadedImageId: "i" }).success).toBe(false);
    expect(productImageSchema.safeParse({ ...image, permissionNotes: null }).success).toBe(false);
    expect(productImageSchema.safeParse({ ...image, objectKey: "../../private" }).success).toBe(false);
  });
  it("never publishes directly from draft or rejected state", () => {
    expect(canTransitionProduct("DRAFT", "PUBLISHED")).toBe(false);
    expect(canTransitionProduct("PENDING_REVIEW", "PUBLISHED")).toBe(true);
    expect(canTransitionProduct("REJECTED", "PUBLISHED")).toBe(false);
    expect(canTransitionProduct("PUBLISHED", "ARCHIVED")).toBe(true);
  });
  it("separates hard failures, warnings and missing optional data", () => {
    const facts = { brandId: "b", familyId: "f", generationId: "g", tierId: "t", tierName: "Elite", variantId: "v", colorwayId: "c", surface: "AG", source: { status: "ACTIVE", authorizationStatus: "UNKNOWN" }, claims: [] };
    const report = assessProduct(facts);
    expect(report.errors).toEqual([]); expect(report.warnings).toContain("source_permission_unknown"); expect(report.missingOptional).toContain("weight");
    expect(assessProduct({ ...facts, surface: "BAD" }).errors).toContain("invalid_outsole");
    expect(assessProduct({ ...facts, brandId: "" }).errors).toContain("missing_brandId");
    expect(assessProduct({ ...facts, tierName: "Unknown" }).errors).toContain("unknown_tier");
    expect(assessProduct({ ...facts, source: null }).errors).toContain("missing_source");
    expect(assessProduct({ ...facts, claims: [{ attribute: "upperMaterial", value: "a", status: "VERIFIED" }, { attribute: "upperMaterial", value: "b", status: "VERIFIED" }] }).errors).toContain("conflicting_upperMaterial");
    expect(assessProduct({ ...facts, claims: [{ attribute: "upperMaterial", value: "a", status: "CONFLICTED" }] }).errors).toContain("unresolved_claim_conflict");
  });
});
