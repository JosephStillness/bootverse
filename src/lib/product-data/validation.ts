import {compareClaims,isExplicitUnknown} from "./comparison";
import { z } from "zod";
import { surfaces } from "@/lib/boots/types";
import { currencyCodes } from "@/lib/foot-profile/currencies";

export const dataId = z.string().trim().min(1).max(100);
const text = z.string().trim().min(1).max(1000);
export const publicSourceUrl = z.url().max(2000).refine(value => {
  const u = new URL(value);
  return u.protocol === "https:" && !u.username && !u.password && !u.hash &&
    !/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(u.hostname) &&
    !u.hostname.includes(":") && !u.hostname.endsWith(".local") &&
    !/^\d+(?:\.\d+){0,3}$/.test(u.hostname) &&
    !Array.from(u.searchParams.keys()).some(key => /token|secret|signature|api.?key|password|credential|authorization|^key$|^auth$|^sig$|x-amz/i.test(key));
}, "Use a public HTTPS URL without credentials or secret query parameters.");
export const sourceTypes = ["MANUFACTURER", "RETAILER", "PRODUCT_FEED", "AFFILIATE_FEED", "MANUAL_RESEARCH", "COMMUNITY", "OTHER"] as const;
export const claimStates = ["UNVERIFIED", "PENDING_REVIEW", "VERIFIED", "CONFLICTED", "REJECTED"] as const;
export const productStates = ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "ARCHIVED", "REJECTED"] as const;
export type ClaimState = typeof claimStates[number];
export type ProductState = typeof productStates[number];
const permissionFields = {
  permissionNotes: text.nullable().optional(), permissionUrl: publicSourceUrl.nullable().optional(),
};
export const sourceSchema = z.object({
  name: z.string().trim().min(1).max(120), type: z.enum(sourceTypes),
  baseUrl: publicSourceUrl, brandId: dataId.nullable().optional(),
  accessMethod: z.string().trim().min(1).max(120),
  authorizationStatus: z.enum(["UNKNOWN", "REQUESTED", "GRANTED", "DENIED", "NOT_REQUIRED"]).default("UNKNOWN"),
  ...permissionFields, usageRestrictions: text.nullable().optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).default("ACTIVE"),
  lastCheckedAt: z.iso.datetime({ offset: true }).refine(v => Date.parse(v) <= Date.now()).nullable().optional(),
}).strict().superRefine((data, ctx) => {
  if (["GRANTED", "NOT_REQUIRED"].includes(data.authorizationStatus) && (!data.permissionNotes || !data.permissionUrl))
    ctx.addIssue({ code: "custom", path: ["authorizationStatus"], message: "Document the permission or why permission is not required, with a reference URL." });
  if (data.type === "MANUFACTURER" && !data.brandId)
    ctx.addIssue({ code: "custom", path: ["brandId"], message: "A manufacturer source must identify its brand." });
});
export const brandSchema = z.object({ name: z.string().trim().min(1).max(100).transform(v => v.normalize("NFC")), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100), officialWebsite: publicSourceUrl.nullable().optional() }).strict();
export const productDraftSchema = z.object({
  slug: z.string().max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  variantId: dataId, colorwayId: dataId, sourceId: dataId, sample: z.boolean().default(false),
}).strict();
export const identifierSchema = z.object({
  value: z.string().trim().min(1).max(120).transform(v => v.normalize("NFC")),
  region: z.string().regex(/^(UNSPECIFIED|GLOBAL|[A-Z]{2})$/).default("UNSPECIFIED"),
  sourceId: dataId, sourceUrl: publicSourceUrl,
}).strict();
export const textAttributes = ["upperMaterial", "upperTechnology", "outsoleConstruction", "studConfiguration", "closureSystem", "collarType", "tongueConfiguration", "surfaceDesignation", "manufacturerFitDescription", "construction", "surfaceTexture", "toeBoxConstruction", "midfootConstruction", "heelStructure", "soleplateMaterial", "soleplateTechnology", "playingSurfaceGuidance"] as const;
const observedAt = z.iso.datetime({ offset: true }).refine(v => Date.parse(v) <= Date.now(), "Observation cannot be in the future.");
const target = { entryId: dataId.optional(), variantId: dataId.optional() };
const claimBase = { ...target, sourceId: dataId, sourceUrl: publicSourceUrl, observedAt, basis: z.enum(["REPORTED", "MEASURED", "COMMUNITY", "EXPERT"]), notes: text.nullable().optional(), sourceRevision: z.string().trim().min(1).max(200).nullable().optional() };
export const weightValue = z.object({ amount: z.number().finite().positive().max(1000), unit: z.enum(["g", "oz"]), size: z.string().trim().min(1).max(30), sizeSystem: z.enum(["UK", "US", "EU", "CM"]), method: text.optional() }).strict();
export const allAttributes = [...textAttributes, "weight", "releaseDate", "additionalFeatures", "normalizedOutsoleCategory"] as const;
export const claimSchema = z.union([
  z.object({ ...claimBase, attribute: z.literal("normalizedOutsoleCategory"), value: z.enum(surfaces) }).strict(),
  z.object({ ...claimBase, attribute: z.enum(allAttributes), value: z.object({ unknown: z.literal(true) }).strict() }).strict(),
  z.object({ ...claimBase, attribute: z.enum(textAttributes), value: text }).strict(),
  z.object({ ...claimBase, attribute: z.literal("weight"), value: weightValue }).strict(),
  z.object({ ...claimBase, attribute: z.literal("releaseDate"), value: z.iso.date() }).strict(),
  z.object({ ...claimBase, attribute: z.literal("additionalFeatures"), value: z.array(z.string().trim().min(1).max(200)).min(1).max(20) }).strict(),
]).superRefine((data, ctx) => {
  if (Number(!!data.entryId) + Number(!!data.variantId) !== 1)
    ctx.addIssue({ code: "custom", message: "Choose exactly one product or construction variant." });
  if (data.attribute === "weight" && data.basis === "MEASURED" && !("unknown" in data.value) && !data.value.method)
    ctx.addIssue({ code: "custom", path: ["value"], message: "Describe the measurement method." });
});
export const decisionSchema = z.object({ status: z.enum(claimStates), note: z.string().trim().min(10).max(1000), sourceChecked: z.boolean().default(false) }).strict().refine(v => v.status !== "VERIFIED" || v.sourceChecked, "Explicitly confirm that the claim was checked against its source.");
export const publicationSchema = z.object({ status: z.enum(productStates), note: z.string().trim().min(10).max(1000) }).strict();
export const productImageSchema = z.object({
  uploadedImageId: dataId.optional(), externalUrl: publicSourceUrl.optional(), sourceId: dataId,
  sourceUrl: publicSourceUrl, attribution: z.string().trim().min(1).max(300), altText: z.string().trim().min(1).max(300),
  licenseStatus: z.enum(["UNKNOWN", "GRANTED", "DENIED"]).default("UNKNOWN"), ...permissionFields,
  sortOrder: z.number().int().min(0).max(1000).default(0), isPrimary: z.boolean().default(false),
}).strict().superRefine((data, ctx) => {
  if (Number(!!data.uploadedImageId) + Number(!!data.externalUrl) !== 1)
    ctx.addIssue({ code: "custom", message: "Choose an existing upload or an authorized external URL, never an object key." });
  if (data.licenseStatus === "GRANTED" && (!data.permissionNotes || !data.permissionUrl))
    ctx.addIssue({ code: "custom", message: "Document image usage permission." });
});
export const offerSchema = z.object({ sourceId: dataId, sourceUrl: publicSourceUrl, countryCode: z.string().regex(/^[A-Z]{2}$/).nullable().default(null), amount: z.string().regex(/^\d{1,7}(\.\d{1,2})?$/), currency: z.enum(currencyCodes), size: z.string().regex(/^\d{1,2}(\.\d{1,2})?$/).nullable().default(null), sizeSystem: z.enum(["UK", "US", "EU", "CM"]).nullable().default(null), observedAt, validUntil: z.iso.datetime({ offset: true }), available: z.boolean().optional() }).strict().refine(v => (v.size === null) === (v.sizeSystem === null) && Date.parse(v.validUntil) > Date.parse(v.observedAt) && (v.available === undefined || v.size !== null), "Use paired size context, future expiry and size-scoped stock.");
export const registryQuery = z.object({ page: z.coerce.number().int().min(1).max(1000).default(1), q: z.string().trim().max(100).default(""), status: z.enum(productStates).optional() }).strict();

export function canTransitionClaim(from: ClaimState, to: ClaimState) {
  const next: Record<ClaimState, ClaimState[]> = { UNVERIFIED: ["PENDING_REVIEW", "REJECTED"], PENDING_REVIEW: ["VERIFIED", "CONFLICTED", "REJECTED"], VERIFIED: ["PENDING_REVIEW", "CONFLICTED"], CONFLICTED: ["PENDING_REVIEW", "REJECTED"], REJECTED: ["PENDING_REVIEW"] };
  return next[from].includes(to);
}
export function canTransitionProduct(from: ProductState, to: ProductState) {
  const next: Record<ProductState, ProductState[]> = { DRAFT: ["PENDING_REVIEW", "REJECTED"], PENDING_REVIEW: ["DRAFT", "PUBLISHED", "REJECTED"], PUBLISHED: ["ARCHIVED"], ARCHIVED: ["PENDING_REVIEW"], REJECTED: ["DRAFT"] };
  return next[from].includes(to);
}
export type QualityClaim = { attribute: string; value: unknown; status: string };
export type ProductFacts = { brandId: string; familyId: string; generationId: string; tierId: string; tierName: string; variantId: string; colorwayId: string; surface: string | null; source: { status: string; authorizationStatus: string } | null; claims: QualityClaim[]; duplicateIdentifier?: boolean; hasIdentifier?: boolean; hasImage?: boolean };
export function assessProduct(facts: ProductFacts) {
  const errors: string[] = [], warnings: string[] = [];
  for (const key of ["brandId", "familyId", "generationId", "tierId", "variantId", "colorwayId"] as const) if (!facts[key]) errors.push(`missing_${key}`);
  if (!facts.tierName.trim() || /^(unknown|unverified)$/i.test(facts.tierName.trim())) errors.push("unknown_tier");
  if (facts.surface !== null && !surfaces.includes(facts.surface as typeof surfaces[number])) errors.push("invalid_outsole");
  if (facts.surface === null) warnings.push("unknown_outsole");
  if (!facts.source) errors.push("missing_source");
  else if (facts.source.status !== "ACTIVE" || facts.source.authorizationStatus === "DENIED") errors.push("unavailable_source");
  else if (["UNKNOWN", "REQUESTED"].includes(facts.source.authorizationStatus)) warnings.push("source_permission_unknown");
  if (facts.duplicateIdentifier) errors.push("duplicate_identifier");
  if (!facts.hasIdentifier) warnings.push("missing_sku");
  if (!facts.hasImage) warnings.push("missing_licensed_image");
  if (facts.claims.length > 200) errors.push("claim_limit");
  if (facts.claims.some(c => c.status === "CONFLICTED")) errors.push("unresolved_claim_conflict");
  const verified = facts.claims.filter(c => c.status === "VERIFIED");
  for (const attribute of new Set(verified.map(c => c.attribute))) if (verified.filter(c=>c.attribute===attribute).some((c,i,group)=>group.slice(i+1).some(d=>compareClaims(attribute,c.value,d.value)==="CONFLICT"))) errors.push(`conflicting_${attribute}`);
  return { ready: errors.length === 0, errors, warnings, missingOptional: [...textAttributes, "weight", "releaseDate", "additionalFeatures"].filter(attribute => !verified.some(c => c.attribute === attribute&&!isExplicitUnknown(c.value))) };
}
