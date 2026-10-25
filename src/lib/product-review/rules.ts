// D4 product validation, readiness and lifecycle rules. Pure and deterministic:
// no database, network or clock access beyond the facts passed in.
import { createHash } from "node:crypto";
import { surfaces } from "@/lib/boots/types";
import { claimSchema, textAttributes, type ProductState } from "@/lib/product-data/validation";
import { compareClaims, isExplicitUnknown } from "@/lib/product-data/comparison";
import { publicAssets } from "@/lib/enrichment/public";
import { normalizeOutsole } from "@/lib/data-import/normalize";
import { stableJson } from "@/lib/data-import/preview";

export type Severity = "BLOCKING_ERROR" | "WARNING" | "INFORMATION";
export type Dimension = "IDENTITY" | "DATA_VALIDITY" | "SOURCE_TRACEABILITY" | "CONFLICTS" | "DUPLICATES" | "IMAGES" | "PAGE_INTEGRITY";
export type Issue = { code: string; severity: Severity; dimension: Dimension; message: string; ref?: string };
export type Readiness = "READY_FOR_REVIEW" | "NEEDS_CORRECTION" | "BLOCKED" | "READY_FOR_APPROVAL";
export type ImageRights = "PERMISSION_CONFIRMED" | "PERMISSION_PENDING" | "PERMISSION_DENIED" | "LICENSE_RESTRICTED";
// SAME_IDENTITY: identical normalized brand/family/generation/tier/outsole/colorway.
// CASE_ONLY_SKU: case-only SKU match with the same generation/tier/outsole (possible mislabeled colorway).
export type DuplicateRelation = "SAME_IDENTITY" | "CASE_ONLY_SKU" | "DIFFERENT_TIER" | "DIFFERENT_OUTSOLE" | "DIFFERENT_GENERATION";
export type DuplicateOutcome = "CONFIRM_NEW" | "LINK_EXISTING" | "REJECT_DUPLICATE" | "INVESTIGATE";

type Named = { id: string; name: string };
type Availability = { status: string; authorizationStatus: string };
export type ReviewClaim = {
  id: string; version: number; entryId: string | null; variantId: string | null; attribute: string; value: unknown; status: string; basis: string;
  sourceId: string; sourceUrl: string; observedAt: Date; reviewedAt: Date | null; source: Availability & { name: string; type: string };
};
export type ReviewImage = {
  id: string; version: number; status: string; reviewedAt: Date | null; licenseStatus: string; isPrimary: boolean; sortOrder: number;
  externalUrl: string | null; uploadedImageId: string | null; permissionUrl: string | null; permissionNotes: string | null;
  sourceUrl: string; altText: string; attribution: string; source: Availability & { usageRestrictions: string | null };
  uploadedImage: { width: number; height: number; state: string; status: string; productEntryId: string | null } | null;
};
export type ReviewFacts = {
  entry: { id: string; slug: string; status: string; sample: boolean; version: number };
  brand: (Named & { status: string }) | null; family: Named | null; generation: Named | null; tier: Named | null;
  variant: { id: string; surface: string | null; manufacturerOutsole: string | null } | null;
  colorway: (Named & { swatch: string | null }) | null;
  source: (Availability & { id: string; version: number; type: string; brandId: string | null; usageRestrictions: string | null }) | null;
  identifiers: { id: string; value: string; region: string; source: Availability }[];
  sourceRecordCount: number;
  claims: ReviewClaim[];
  images: ReviewImage[];
  duplicates: { candidateId: string; slug: string; status: string; relation: DuplicateRelation; skuCaseCollision?: boolean }[];
  duplicateDecision: { outcome: DuplicateOutcome; candidateIds: string[] } | null;
  stagedProposals: number;
  overflow: boolean;
  now: Date;
};

export const lifecycleActions = ["SUBMIT", "APPROVE", "REJECT", "RETURN", "REOPEN", "ARCHIVE", "RESUBMIT"] as const;
export type LifecycleAction = typeof lifecycleActions[number];
// The only permitted publication transitions. Every edge matches D1's canTransitionProduct table.
const transitions: Record<LifecycleAction, { from: ProductState[]; to: ProductState }> = {
  SUBMIT: { from: ["DRAFT"], to: "PENDING_REVIEW" },
  APPROVE: { from: ["PENDING_REVIEW"], to: "PUBLISHED" },
  REJECT: { from: ["DRAFT", "PENDING_REVIEW"], to: "REJECTED" },
  RETURN: { from: ["PENDING_REVIEW"], to: "DRAFT" },
  REOPEN: { from: ["REJECTED"], to: "DRAFT" },
  ARCHIVE: { from: ["PUBLISHED"], to: "ARCHIVED" },
  RESUBMIT: { from: ["ARCHIVED"], to: "PENDING_REVIEW" },
};
export function lifecycleTarget(action: LifecycleAction, from: string): ProductState | null {
  const rule = transitions[action];
  return rule.from.includes(from as ProductState) ? rule.to : null;
}
export function actionForStatus(from: string, to: string): LifecycleAction | null {
  return lifecycleActions.find(a => lifecycleTarget(a, from) === to) ?? null;
}

const available = (s: Availability | null) => !!s && s.status === "ACTIVE" && s.authorizationStatus !== "DENIED";
const permitted = (s: Availability) => s.status === "ACTIVE" && ["GRANTED", "NOT_REQUIRED"].includes(s.authorizationStatus);
const label = (attribute: string) => attribute.replace(/([A-Z])/g, " $1").toLowerCase();

export function imageRights(image: ReviewImage): ImageRights {
  if (image.licenseStatus === "DENIED" || image.source.authorizationStatus === "DENIED") return "PERMISSION_DENIED";
  if (!publicImageEligible(image)) return "PERMISSION_PENDING";
  return image.source.usageRestrictions?.trim() ? "LICENSE_RESTRICTED" : "PERMISSION_CONFIRMED";
}
export const publicImageEligible = (image: ReviewImage) => publicAssets([image]).length === 1;

/** Attributes with a contradiction or an explicit CONFLICTED observation. Every observation is kept, including rejected history. */
export function conflictGroups(claims: ReviewClaim[]) {
  const groups: { attribute: string; claims: ReviewClaim[]; unresolved: boolean }[] = [];
  for (const attribute of [...new Set(claims.map(c => c.attribute))].sort()) {
    const all = claims.filter(c => c.attribute === attribute), live = all.filter(c => c.status !== "REJECTED" && !isExplicitUnknown(c.value));
    const contradiction = live.some((c, i) => live.slice(i + 1).some(d => compareClaims(attribute, c.value, d.value) === "CONFLICT"));
    const unresolved = live.some(c => c.status === "CONFLICTED");
    if (contradiction || unresolved) groups.push({ attribute, claims: all, unresolved: unresolved || contradiction });
  }
  return groups;
}

export function evaluateProduct(f: ReviewFacts) {
  const issues: Issue[] = [];
  const add = (severity: Severity, dimension: Dimension, code: string, message: string, ref?: string) => issues.push({ severity, dimension, code, message, ...(ref ? { ref } : {}) });

  // Identity
  for (const [key, name] of [["brand", "Brand"], ["family", "Boot family"], ["generation", "Generation"], ["tier", "Tier"], ["colorway", "Colorway"]] as const) {
    const value = f[key];
    if (!value || !value.name.trim()) add("BLOCKING_ERROR", "IDENTITY", `missing_${key}`, `${name} is missing. Every published record needs a complete exact identity.`);
  }
  if (!f.variant) add("BLOCKING_ERROR", "IDENTITY", "missing_variant", "The exact outsole/construction variant is missing.");
  if (f.brand && f.brand.status !== "ACTIVE") add("BLOCKING_ERROR", "IDENTITY", "inactive_brand", `Brand “${f.brand.name}” is archived in the registry.`);
  if (f.tier && /^(unknown|unverified)$/i.test(f.tier.name.trim())) add("BLOCKING_ERROR", "IDENTITY", "unknown_tier", "The tier is unknown. Elite, Pro and other tiers are different products and cannot be guessed.");
  const surface = f.variant?.surface ?? null;
  if (f.variant && surface === null) add("BLOCKING_ERROR", "IDENTITY", "unknown_outsole", "The outsole category is unknown. FG, AG and other outsoles are separate products.");
  else if (surface !== null && !surfaces.includes(surface as typeof surfaces[number])) add("BLOCKING_ERROR", "IDENTITY", "invalid_outsole", `Outsole code “${surface}” is not a supported category.`);
  else if (surface && f.variant?.manufacturerOutsole) {
    let mapped: string | null = null, unmapped = false;
    try { mapped = normalizeOutsole(f.variant.manufacturerOutsole); } catch { unmapped = true; }
    if (unmapped) add("INFORMATION", "IDENTITY", "manufacturer_outsole_unmapped", `Manufacturer outsole wording “${f.variant.manufacturerOutsole}” has no known category mapping; check it manually.`);
    else if (mapped && mapped !== surface) add("BLOCKING_ERROR", "IDENTITY", "outsole_inconsistent", `Manufacturer wording “${f.variant.manufacturerOutsole}” suggests ${mapped}, but the variant is classified ${surface}.`);
  }
  if (f.colorway?.swatch && !/^#[0-9a-f]{6}$/i.test(f.colorway.swatch)) add("WARNING", "IDENTITY", "invalid_swatch", "Colorway swatch is not a #RRGGBB colour.");
  if (!f.identifiers.length) add("WARNING", "IDENTITY", "missing_sku", "No manufacturer SKU is recorded. Publication is allowed; identity relies on the full brand/family/generation/tier/outsole/colorway record.");
  for (const s of f.identifiers) if (!available(s.source)) add("WARNING", "IDENTITY", "sku_source_unavailable", `SKU ${s.value} cites a source that is archived or denied.`, s.id);

  // Source traceability
  if (!f.source) add("BLOCKING_ERROR", "SOURCE_TRACEABILITY", "missing_source", "No registered primary source. Identity must be traceable to a registered source.");
  else {
    if (!available(f.source)) add("BLOCKING_ERROR", "SOURCE_TRACEABILITY", "unavailable_source", "The primary source is archived or its use was denied.");
    else if (["UNKNOWN", "REQUESTED"].includes(f.source.authorizationStatus)) add("WARNING", "SOURCE_TRACEABILITY", "source_permission_unknown", "Permission to use the primary source is not documented. A reachable URL does not establish authorization.");
    if (f.source.type === "MANUFACTURER" && f.brand && f.source.brandId !== f.brand.id) add("BLOCKING_ERROR", "SOURCE_TRACEABILITY", "manufacturer_brand_mismatch", "The primary manufacturer source belongs to a different brand.");
    if (f.source.usageRestrictions?.trim()) add("INFORMATION", "SOURCE_TRACEABILITY", "source_usage_restricted", `Source usage restrictions: ${f.source.usageRestrictions.trim().slice(0, 300)}`);
    if (!f.sourceRecordCount && !f.identifiers.length) add("WARNING", "SOURCE_TRACEABILITY", "identity_evidence_limited", "Identity is supported only by the registered primary source; no source record URL or SKU reference exists. Check the source before attesting identity.");
  }
  const live = f.claims.filter(c => c.status !== "REJECTED");
  for (const c of live) {
    if (c.status === "VERIFIED" && !available(c.source)) add("BLOCKING_ERROR", "SOURCE_TRACEABILITY", "verified_claim_source_unavailable", `A verified ${label(c.attribute)} observation cites a source that is now archived or denied.`, c.id);
    if (c.observedAt > f.now) add("BLOCKING_ERROR", "DATA_VALIDITY", "future_observation", `A ${label(c.attribute)} observation is dated in the future.`, c.id);
  }
  const pendingClaims = live.filter(c => c.status !== "VERIFIED").length;
  if (pendingClaims) add("INFORMATION", "SOURCE_TRACEABILITY", "unverified_observations", `${pendingClaims} observation(s) are not verified and will not appear publicly.`);
  if (live.some(c => c.status === "VERIFIED" && ["RETAILER", "AFFILIATE_FEED", "PRODUCT_FEED", "COMMUNITY"].includes(c.source.type)))
    add("INFORMATION", "SOURCE_TRACEABILITY", "source_reported_not_independent", "Some verified values come from retailer, feed or community sources. They are shown as source-reported, never as independently tested.");

  // Data validity
  for (const c of live) {
    const parsed = claimSchema.safeParse({ ...(c.entryId ? { entryId: c.entryId } : { variantId: c.variantId }), attribute: c.attribute, value: c.value, basis: c.basis, sourceId: c.sourceId, sourceUrl: c.sourceUrl, observedAt: new Date(Math.min(c.observedAt.getTime(), Date.now())).toISOString() });
    if (!parsed.success) add(c.status === "VERIFIED" ? "BLOCKING_ERROR" : "WARNING", "DATA_VALIDITY", "malformed_claim", `The ${label(c.attribute)} observation has an unsupported attribute, unit or shape.`, c.id);
    if (c.attribute === "normalizedOutsoleCategory" && surface && typeof c.value === "string" && c.value !== surface)
      add(c.status === "VERIFIED" ? "BLOCKING_ERROR" : "WARNING", "IDENTITY", "outsole_claim_mismatch", `An observation classifies the outsole as ${c.value}, but this variant is ${surface}. Identity is never changed automatically.`, c.id);
  }
  const present = new Set(live.filter(c => c.status === "VERIFIED" && !isExplicitUnknown(c.value)).map(c => c.attribute));
  const missing = [...textAttributes, "weight", "releaseDate", "additionalFeatures"].filter(a => !present.has(a));
  if (missing.length) add("INFORMATION", "DATA_VALIDITY", "missing_optional_specifications", `${missing.length} optional specification(s) have no verified value and will show as unknown.`);

  // Conflicts
  for (const group of conflictGroups(f.claims)) {
    const g = group.claims.filter(c => c.status !== "REJECTED" && !isExplicitUnknown(c.value));
    const verified = g.filter(c => c.status === "VERIFIED");
    if (g.some(c => c.status === "CONFLICTED")) add("BLOCKING_ERROR", "CONFLICTS", "unresolved_conflict", `Conflicting ${label(group.attribute)} evidence is unresolved.`, group.attribute);
    else if (verified.some((c, i) => verified.slice(i + 1).some(d => compareClaims(group.attribute, c.value, d.value) === "CONFLICT"))) add("BLOCKING_ERROR", "CONFLICTS", "verified_conflict", `Two verified ${label(group.attribute)} values contradict each other.`, group.attribute);
    else add("WARNING", "CONFLICTS", "contradictory_unverified", `Unverified ${label(group.attribute)} observations disagree. They are not public; resolve before verifying either.`, group.attribute);
  }
  const weights = live.filter(c => c.attribute === "weight");
  if (weights.some((c, i) => weights.slice(i + 1).some(d => compareClaims("weight", c.value, d.value) === "DIFFERENT_CONTEXT")))
    add("INFORMATION", "CONFLICTS", "measurement_context_differs", "Weight observations use different sizes, size systems or methods; they are not treated as contradictions.");

  // Duplicates
  const risky = f.duplicates.filter(d => (d.relation === "SAME_IDENTITY" || d.relation === "CASE_ONLY_SKU") && d.status !== "REJECTED");
  const decision = f.duplicateDecision;
  if (risky.length) {
    if (decision?.outcome === "INVESTIGATE") add("BLOCKING_ERROR", "DUPLICATES", "duplicate_under_investigation", "An administrator flagged this product for duplicate investigation.");
    else if (decision?.outcome === "CONFIRM_NEW" && risky.every(d => decision.candidateIds.includes(d.candidateId))) add("INFORMATION", "DUPLICATES", "confirmed_distinct", `An administrator confirmed this is distinct from ${risky.length} similar record(s).`);
    else for (const d of risky) add("BLOCKING_ERROR", "DUPLICATES", "possible_duplicate", d.relation === "CASE_ONLY_SKU" ? `SKU differs only by letter case from ${d.slug} (${d.status}).` : `Same brand, family, generation, tier, outsole and colorway as ${d.slug} (${d.status}).`, d.candidateId);
  }
  for (const d of f.duplicates) {
    if (d.relation !== "SAME_IDENTITY" && d.relation !== "CASE_ONLY_SKU") {
      add("INFORMATION", "DUPLICATES", "distinct_similar_product", `${d.slug} has a similar name but a ${d.relation.replace("DIFFERENT_", "different ").toLowerCase()}; it is a separate product and is never merged.`, d.candidateId);
      if (d.skuCaseCollision) add("WARNING", "DUPLICATES", "sku_case_collision", `${d.slug} is a different product but its SKU differs from this one only by letter case. Check both identifiers.`, d.candidateId);
    }
    else if (d.status === "REJECTED") add("INFORMATION", "DUPLICATES", "rejected_similar_product", `${d.slug} has the same identity but was rejected.`, d.candidateId);
  }
  if (f.stagedProposals) add("WARNING", "DUPLICATES", "pending_source_proposals", `${f.stagedProposals} staged import proposal(s) reference this product and await resolution.`);

  // Images
  const eligible = f.images.filter(publicImageEligible);
  for (const image of f.images) {
    if (image.uploadedImage?.productEntryId && image.uploadedImage.productEntryId !== f.entry.id) add("BLOCKING_ERROR", "IMAGES", "image_wrong_product", "An image metadata record points to a file uploaded for a different product.", image.id);
    if (image.status !== "VERIFIED") continue;
    const rightsOk = image.licenseStatus === "GRANTED" && !!image.permissionNotes && !!image.permissionUrl && permitted(image.source);
    if (!rightsOk) add("BLOCKING_ERROR", "IMAGES", "image_rights_invalid", "An image is marked verified, but its usage permission or source authorization is no longer valid.", image.id);
    else if (!publicImageEligible(image)) add("WARNING", "IMAGES", "image_asset_unavailable", "A verified image file is not currently accessible; it will not be shown.", image.id);
  }
  if (!eligible.length) add("WARNING", "IMAGES", "placeholder_image", "No authorized image is available. The public page will show a neutral placeholder; no manufacturer image is substituted.");
  const primary = f.images.find(i => i.isPrimary);
  if (primary && !publicImageEligible(primary) && eligible.length) add("WARNING", "IMAGES", "primary_not_public", "The primary image is not publicly eligible; the first authorized image will be shown instead.", primary.id);
  const denied = f.images.filter(i => imageRights(i) === "PERMISSION_DENIED").length;
  if (denied) add("INFORMATION", "IMAGES", "images_denied", `${denied} image(s) have denied permission and are never shown.`);
  const restricted = eligible.filter(i => imageRights(i) === "LICENSE_RESTRICTED").length;
  if (restricted) add("WARNING", "IMAGES", "image_license_restricted", `${restricted} authorized image(s) carry source usage restrictions; confirm the product page complies.`);

  // Public page integrity
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(f.entry.slug) || f.entry.slug.length > 160) add("BLOCKING_ERROR", "PAGE_INTEGRITY", "invalid_slug", "The public URL slug is malformed.");
  if (f.entry.sample) add("WARNING", "PAGE_INTEGRITY", "sample_record", "This is a sample record; it is labeled as unverified sample data on public pages.");
  if (f.overflow) add("BLOCKING_ERROR", "PAGE_INTEGRITY", "record_limit", "Too many related records to inspect completely. Approval is refused rather than reviewing a truncated view.");

  const blocking = issues.filter(i => i.severity === "BLOCKING_ERROR");
  const hard: Dimension[] = ["IDENTITY", "SOURCE_TRACEABILITY", "PAGE_INTEGRITY"];
  const readiness: Readiness = blocking.some(i => hard.includes(i.dimension)) ? "BLOCKED" : blocking.length ? "NEEDS_CORRECTION" : f.entry.status === "PENDING_REVIEW" ? "READY_FOR_APPROVAL" : "READY_FOR_REVIEW";
  const dimensions = Object.fromEntries((["IDENTITY", "DATA_VALIDITY", "SOURCE_TRACEABILITY", "CONFLICTS", "DUPLICATES", "IMAGES", "PAGE_INTEGRITY"] as Dimension[]).map(d => {
    const own = issues.filter(i => i.dimension === d);
    return [d, own.some(i => i.severity === "BLOCKING_ERROR") ? "FAIL" : own.some(i => i.severity === "WARNING") ? "WARN" : "PASS"];
  })) as Record<Dimension, "PASS" | "WARN" | "FAIL">;
  const order: Record<Severity, number> = { BLOCKING_ERROR: 0, WARNING: 1, INFORMATION: 2 };
  issues.sort((a, b) => order[a.severity] - order[b.severity]);
  return { readiness, issues, dimensions, counts: { blocking: blocking.length, warnings: issues.filter(i => i.severity === "WARNING").length, information: issues.filter(i => i.severity === "INFORMATION").length }, eligibleImages: eligible.length };
}

/** Hash of every input the reviewer saw. Approval is refused if this changes before commit. */
export function reviewFingerprint(f: ReviewFacts) {
  const ids = <T extends { id: string }>(rows: T[], pick: (r: T) => unknown) => [...rows].sort((a, b) => a.id.localeCompare(b.id)).map(pick);
  return createHash("sha256").update(stableJson({
    entry: f.entry, brand: f.brand, family: f.family, generation: f.generation, tier: f.tier, variant: f.variant, colorway: f.colorway,
    source: f.source && { id: f.source.id, version: f.source.version, status: f.source.status, auth: f.source.authorizationStatus },
    identifiers: ids(f.identifiers, s => [s.id, s.value, s.region]), claims: ids(f.claims, c => [c.id, c.version, c.status]),
    images: ids(f.images, i => [i.id, i.version, i.status, i.licenseStatus, i.isPrimary]),
    // A distinct sibling (other tier/outsole/generation) changing status does not make this review stale.
    duplicates: [...f.duplicates].sort((a, b) => a.candidateId.localeCompare(b.candidateId)).map(d => [d.candidateId, d.relation, d.relation === "SAME_IDENTITY" || d.relation === "CASE_ONLY_SKU" ? d.status : null, !!d.skuCaseCollision]),
    duplicateDecision: f.duplicateDecision, stagedProposals: f.stagedProposals, overflow: f.overflow,
  })).digest("hex");
}
