import { describe, expect, it } from "vitest";
import { evaluateProduct, imageRights, lifecycleTarget, reviewFingerprint, conflictGroups, type ReviewFacts } from "./rules";

// Synthetic fixtures only; none of these values describe a real product.
const source = { id: "src", version: 1, type: "MANUAL_RESEARCH", status: "ACTIVE", authorizationStatus: "NOT_REQUIRED", brandId: null, usageRestrictions: null };
const claimSource = { name: "Synthetic", type: "MANUAL_RESEARCH", status: "ACTIVE", authorizationStatus: "NOT_REQUIRED" };
const claim = (over: Partial<ReviewFacts["claims"][number]> = {}): ReviewFacts["claims"][number] => ({ id: "c1", version: 1, entryId: "e1", variantId: null, attribute: "upperMaterial", value: "Synthetic knit", status: "UNVERIFIED", basis: "REPORTED", sourceId: "src", sourceUrl: "https://example.test/spec", observedAt: new Date("2026-10-01T00:00:00Z"), reviewedAt: null, source: claimSource, ...over });
const image = (over: Partial<ReviewFacts["images"][number]> = {}): ReviewFacts["images"][number] => ({ id: "i1", version: 1, status: "VERIFIED", reviewedAt: new Date("2026-10-02T00:00:00Z"), licenseStatus: "GRANTED", isPrimary: true, sortOrder: 0, externalUrl: null, uploadedImageId: "u1", permissionUrl: "https://example.test/licence", permissionNotes: "Synthetic written permission", sourceUrl: "https://example.test/photo", altText: "Synthetic boot", attribution: "Synthetic", source: { status: "ACTIVE", authorizationStatus: "GRANTED", usageRestrictions: null }, uploadedImage: { width: 10, height: 10, state: "READY", status: "PUBLISHED", productEntryId: "e1" }, ...over });
function facts(over: Partial<ReviewFacts> = {}): ReviewFacts {
  return {
    entry: { id: "e1", slug: "synthetic-boot-fg", status: "PENDING_REVIEW", sample: false, version: 3 },
    brand: { id: "b", name: "Synthetic Brand", status: "ACTIVE" }, family: { id: "f", name: "Family" }, generation: { id: "g", name: "Gen 1" },
    tier: { id: "t", name: "Elite" }, variant: { id: "v", surface: "FG", manufacturerOutsole: "FG" }, colorway: { id: "c", name: "Synthetic blue", swatch: "#112233" },
    source, identifiers: [{ id: "sku1", value: "SYN-001", region: "UNSPECIFIED", source: { status: "ACTIVE", authorizationStatus: "NOT_REQUIRED" } }], sourceRecordCount: 1,
    claims: [], images: [image()], duplicates: [], duplicateDecision: null, stagedProposals: 0, overflow: false, now: new Date("2026-10-25T00:00:00Z"), ...over,
  };
}
const codes = (f: ReviewFacts) => evaluateProduct(f).issues.map(i => `${i.severity}:${i.code}`);

describe("D4 product validation engine", () => {
  it("marks a complete pending record ready for approval without inventing a confidence score", () => {
    const result = evaluateProduct(facts());
    expect(result.readiness).toBe("READY_FOR_APPROVAL");
    expect(result.counts.blocking).toBe(0);
    expect(JSON.stringify(result)).not.toMatch(/confidence|percent|%/i);
  });
  it("blocks a missing critical identity field", () => {
    const result = evaluateProduct(facts({ colorway: null }));
    expect(result.readiness).toBe("BLOCKED");
    expect(codes(facts({ colorway: null }))).toContain("BLOCKING_ERROR:missing_colorway");
  });
  it("blocks unknown tiers and unknown outsoles but not missing optional specifications", () => {
    expect(codes(facts({ tier: { id: "t", name: "Unknown" } }))).toContain("BLOCKING_ERROR:unknown_tier");
    expect(codes(facts({ variant: { id: "v", surface: null, manufacturerOutsole: null } }))).toContain("BLOCKING_ERROR:unknown_outsole");
    const r = evaluateProduct(facts({ claims: [] }));
    expect(r.counts.blocking).toBe(0);
    expect(r.issues.find(i => i.code === "missing_optional_specifications")?.severity).toBe("INFORMATION");
  });
  it("blocks invalid or inconsistent outsole data", () => {
    expect(codes(facts({ variant: { id: "v", surface: "XX", manufacturerOutsole: null } }))).toContain("BLOCKING_ERROR:invalid_outsole");
    expect(codes(facts({ variant: { id: "v", surface: "FG", manufacturerOutsole: "Artificial Grass" } }))).toContain("BLOCKING_ERROR:outsole_inconsistent");
    expect(codes(facts({ claims: [claim({ attribute: "normalizedOutsoleCategory", value: "AG", status: "VERIFIED", reviewedAt: new Date() })] }))).toContain("BLOCKING_ERROR:outsole_claim_mismatch");
    expect(codes(facts({ claims: [claim({ attribute: "normalizedOutsoleCategory", value: "AG" })] }))).toContain("WARNING:outsole_claim_mismatch");
  });
  it("warns, never blocks, when no SKU is available", () => {
    expect(codes(facts({ identifiers: [] }))).toContain("WARNING:missing_sku");
  });
  it("blocks unresolved and verified-vs-verified conflicts but only warns for unverified contradictions", () => {
    const verified = claim({ id: "a", status: "VERIFIED", reviewedAt: new Date() });
    expect(codes(facts({ claims: [verified, claim({ id: "b", value: "Leather", status: "CONFLICTED" })] }))).toContain("BLOCKING_ERROR:unresolved_conflict");
    expect(codes(facts({ claims: [verified, claim({ id: "b", value: "Leather", status: "VERIFIED", reviewedAt: new Date() })] }))).toContain("BLOCKING_ERROR:verified_conflict");
    expect(codes(facts({ claims: [claim({ id: "a" }), claim({ id: "b", value: "Leather" })] }))).toContain("WARNING:contradictory_unverified");
    expect(evaluateProduct(facts({ claims: [verified, claim({ id: "b", value: "Leather", status: "CONFLICTED" })] })).readiness).toBe("NEEDS_CORRECTION");
  });
  it("does not treat weights from different sizes or methods as contradictions", () => {
    const w = (id: string, size: string, amount: number) => claim({ id, attribute: "weight", value: { amount, unit: "g", size, sizeSystem: "UK" } });
    const issues = codes(facts({ claims: [w("a", "8", 190), w("b", "9", 205)] }));
    expect(issues).not.toContain("WARNING:contradictory_unverified");
    expect(issues).toContain("INFORMATION:measurement_context_differs");
    expect(codes(facts({ claims: [w("a", "9", 190), w("b", "9", 205)] }))).toContain("WARNING:contradictory_unverified");
  });
  it("blocks malformed verified attributes", () => {
    expect(codes(facts({ claims: [claim({ attribute: "weight", value: 200, status: "VERIFIED", reviewedAt: new Date() })] }))).toContain("BLOCKING_ERROR:malformed_claim");
    expect(codes(facts({ claims: [claim({ attribute: "nonsense", value: "x" })] }))).toContain("WARNING:malformed_claim");
  });
  it("blocks missing or unavailable sources and labels marketing claims", () => {
    expect(evaluateProduct(facts({ source: null })).readiness).toBe("BLOCKED");
    expect(codes(facts({ source: { ...source, authorizationStatus: "DENIED" } }))).toContain("BLOCKING_ERROR:unavailable_source");
    expect(codes(facts({ source: { ...source, authorizationStatus: "UNKNOWN" } }))).toContain("WARNING:source_permission_unknown");
    const retail = claim({ status: "VERIFIED", reviewedAt: new Date(), source: { ...claimSource, type: "RETAILER" } });
    expect(codes(facts({ claims: [retail] }))).toContain("INFORMATION:source_reported_not_independent");
  });
  it("blocks a verified claim whose source was revoked", () => {
    expect(codes(facts({ claims: [claim({ status: "VERIFIED", reviewedAt: new Date(), source: { ...claimSource, authorizationStatus: "DENIED" } })] }))).toContain("BLOCKING_ERROR:verified_claim_source_unavailable");
  });
  it("blocks unresolved possible duplicates until an administrator confirms the product is distinct", () => {
    const duplicates = [{ candidateId: "e2", slug: "other", status: "PUBLISHED", relation: "SAME_IDENTITY" as const }];
    expect(codes(facts({ duplicates }))).toContain("BLOCKING_ERROR:possible_duplicate");
    expect(evaluateProduct(facts({ duplicates, duplicateDecision: { outcome: "CONFIRM_NEW", candidateIds: ["e2"] } })).counts.blocking).toBe(0);
    expect(codes(facts({ duplicates, duplicateDecision: { outcome: "INVESTIGATE", candidateIds: ["e2"] } }))).toContain("BLOCKING_ERROR:duplicate_under_investigation");
    // A confirmation does not cover a candidate that appeared afterwards.
    expect(codes(facts({ duplicates: [...duplicates, { candidateId: "e3", slug: "new", status: "DRAFT", relation: "CASE_ONLY_SKU" }], duplicateDecision: { outcome: "CONFIRM_NEW", candidateIds: ["e2"] } }))).toContain("BLOCKING_ERROR:possible_duplicate");
  });
  it("keeps Elite/Pro, FG/AG and different generations distinct", () => {
    const distinct = (["DIFFERENT_TIER", "DIFFERENT_OUTSOLE", "DIFFERENT_GENERATION"] as const).map((relation, n) => ({ candidateId: `x${n}`, slug: `x${n}`, status: "PUBLISHED", relation }));
    const r = evaluateProduct(facts({ duplicates: distinct }));
    expect(r.counts.blocking).toBe(0);
    expect(r.issues.filter(i => i.code === "distinct_similar_product")).toHaveLength(3);
  });
  it("warns about a case-only SKU collision between distinct FG and AG products without merging them", () => {
    const r = evaluateProduct(facts({ duplicates: [{ candidateId: "ag", slug: "synthetic-ag", status: "DRAFT", relation: "DIFFERENT_OUTSOLE", skuCaseCollision: true }] }));
    expect(r.counts.blocking).toBe(0);
    expect(r.issues.map(i => i.code)).toContain("sku_case_collision");
  });
  it("blocks unauthorized images marked for public use and allows a safe placeholder", () => {
    expect(codes(facts({ images: [image({ source: { status: "ACTIVE", authorizationStatus: "DENIED", usageRestrictions: null } })] }))).toContain("BLOCKING_ERROR:image_rights_invalid");
    expect(codes(facts({ images: [image({ uploadedImage: { width: 1, height: 1, state: "READY", status: "PUBLISHED", productEntryId: "other" } })] }))).toContain("BLOCKING_ERROR:image_wrong_product");
    const none = evaluateProduct(facts({ images: [] }));
    expect(none.counts.blocking).toBe(0);
    expect(none.issues.find(i => i.code === "placeholder_image")?.severity).toBe("WARNING");
    expect(codes(facts({ images: [image({ status: "UNVERIFIED", reviewedAt: null, licenseStatus: "UNKNOWN" })] }))).toContain("WARNING:placeholder_image");
  });
  it("classifies image rights states", () => {
    expect(imageRights(image())).toBe("PERMISSION_CONFIRMED");
    expect(imageRights(image({ status: "UNVERIFIED", reviewedAt: null }))).toBe("PERMISSION_PENDING");
    expect(imageRights(image({ licenseStatus: "DENIED", status: "REJECTED" }))).toBe("PERMISSION_DENIED");
    expect(imageRights(image({ source: { status: "ACTIVE", authorizationStatus: "GRANTED", usageRestrictions: "Editorial use only" } }))).toBe("LICENSE_RESTRICTED");
  });
  it("reports pending source proposals and draft readiness", () => {
    expect(codes(facts({ stagedProposals: 2 }))).toContain("WARNING:pending_source_proposals");
    expect(evaluateProduct(facts({ entry: { id: "e1", slug: "s", status: "DRAFT", sample: false, version: 1 } })).readiness).toBe("READY_FOR_REVIEW");
  });
  it("blocks truncated inspections instead of approving a partial view", () => {
    expect(evaluateProduct(facts({ overflow: true })).readiness).toBe("BLOCKED");
  });
});

describe("D4 lifecycle and stale-review protection", () => {
  it("allows only documented transitions", () => {
    expect(lifecycleTarget("SUBMIT", "DRAFT")).toBe("PENDING_REVIEW");
    expect(lifecycleTarget("APPROVE", "PENDING_REVIEW")).toBe("PUBLISHED");
    expect(lifecycleTarget("REJECT", "PENDING_REVIEW")).toBe("REJECTED");
    expect(lifecycleTarget("RETURN", "PENDING_REVIEW")).toBe("DRAFT");
    expect(lifecycleTarget("REOPEN", "REJECTED")).toBe("DRAFT");
    expect(lifecycleTarget("ARCHIVE", "PUBLISHED")).toBe("ARCHIVED");
    expect(lifecycleTarget("RESUBMIT", "ARCHIVED")).toBe("PENDING_REVIEW");
    expect(lifecycleTarget("APPROVE", "DRAFT")).toBeNull();
    expect(lifecycleTarget("ARCHIVE", "DRAFT")).toBeNull();
    expect(lifecycleTarget("REOPEN", "PUBLISHED")).toBeNull();
  });
  it("changes the review fingerprint when evidence changes", () => {
    const base = facts({ claims: [claim()] });
    expect(reviewFingerprint(base)).toBe(reviewFingerprint(facts({ claims: [claim()] })));
    expect(reviewFingerprint(base)).not.toBe(reviewFingerprint(facts({ claims: [claim({ version: 2, status: "PENDING_REVIEW" })] })));
    expect(reviewFingerprint(base)).not.toBe(reviewFingerprint(facts({ claims: [claim(), claim({ id: "c2" })] })));
    expect(reviewFingerprint(base)).toMatch(/^[a-f0-9]{64}$/);
  });
  it("groups contradictory claims per attribute and keeps every observation", () => {
    const groups = conflictGroups([claim({ id: "a" }), claim({ id: "b", value: "Leather", status: "CONFLICTED" }), claim({ id: "r", value: "Mesh", status: "REJECTED" })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].claims.map(c => c.id).sort()).toEqual(["a", "b", "r"]);
  });
});

describe("D4 fingerprint scope", () => {
  it("ignores status changes of distinct siblings but not of possible duplicates", () => {
    const sibling = (status: string, relation: "DIFFERENT_TIER" | "SAME_IDENTITY") => facts({ duplicates: [{ candidateId: "x", slug: "x", status, relation }] });
    expect(reviewFingerprint(sibling("PENDING_REVIEW", "DIFFERENT_TIER"))).toBe(reviewFingerprint(sibling("PUBLISHED", "DIFFERENT_TIER")));
    expect(reviewFingerprint(sibling("PENDING_REVIEW", "SAME_IDENTITY"))).not.toBe(reviewFingerprint(sibling("REJECTED", "SAME_IDENTITY")));
  });
});

describe("D4 rejected duplicate candidates", () => {
  it("does not block on a same-identity record that was already rejected", () => {
    const r = evaluateProduct(facts({ duplicates: [{ candidateId: "old", slug: "old", status: "REJECTED", relation: "SAME_IDENTITY" }] }));
    expect(r.counts.blocking).toBe(0);
    expect(r.issues.map(i => i.code)).toContain("rejected_similar_product");
  });
});

describe("D5 source-sync changes in D4 readiness", () => {
  it("blocks approval on a critical pending source change and warns on a material one", () => {
    expect(codes(facts({ syncChanges: [{ id: "s1", kind: "SKU_CHANGE", severity: "CRITICAL" }] }))).toContain("BLOCKING_ERROR:source_change_critical");
    expect(evaluateProduct(facts({ syncChanges: [{ id: "s1", kind: "IDENTITY_CONFLICT", severity: "CRITICAL" }] })).readiness).toBe("NEEDS_CORRECTION");
    expect(codes(facts({ syncChanges: [{ id: "s2", kind: "IMAGE_ADDED", severity: "MATERIAL" }] }))).toContain("WARNING:source_change_pending");
    expect(evaluateProduct(facts({ syncChanges: [{ id: "s3", kind: "SPEC_CORROBORATION", severity: "ROUTINE" }] })).counts.warnings).toBe(evaluateProduct(facts()).counts.warnings);
  });
  it("makes a review stale when a new source change arrives", () => {
    expect(reviewFingerprint(facts())).not.toBe(reviewFingerprint(facts({ syncChanges: [{ id: "s1", kind: "SKU_CHANGE", severity: "CRITICAL" }] })));
  });
});
