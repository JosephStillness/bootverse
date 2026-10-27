import { z } from "zod";
import { dataId, productStates, publicSourceUrl, allAttributes } from "@/lib/product-data/validation";
import { lifecycleActions } from "./rules";

const reason = z.string().trim().min(10, "Give a reason of at least 10 characters.").max(2000);
const version = z.number().int().positive();
const fingerprint = z.string().regex(/^[a-f0-9]{64}$/);
// Client-generated once per intent (dialog open) and reused on retry.
export const requestId = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);

export const transitionSchema = z.object({
  action: z.enum(lifecycleActions), version, reason, reviewFingerprint: fingerprint.optional(), requestId: requestId.optional(),
  identityConfirmed: z.boolean().default(false), evidenceChecked: z.boolean().default(false),
}).strict();
export type TransitionInput = z.infer<typeof transitionSchema>;
// The D4 review UI must prove it saw the current evidence and make the approval retry-safe.
export const reviewTransitionSchema = transitionSchema.refine(v => v.action !== "APPROVE" || (!!v.reviewFingerprint && !!v.requestId), "Approval requires the reviewed fingerprint and a request ID.");
// D1 compatibility contract for PATCH /api/admin/products/[id].
export const legacyPublicationSchema = z.object({ status: z.enum(productStates), version, note: reason, identityConfirmed: z.boolean().default(false), evidenceChecked: z.boolean().default(false) }).strict();

export const noteSchema = z.object({ note: reason, version, requestId: requestId.optional() }).strict();

export const reviewQuery = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  q: z.string().trim().max(100).default(""),
  status: z.enum(productStates).optional(),
  sourceId: dataId.optional(),
  quality: z.enum(["conflicts", "missing_image", "missing_sku", "unknown_outsole", "staged_proposals", "sync_changes"]).optional(),
  sort: z.enum(["submitted_desc", "submitted_asc", "created_desc", "updated_desc"]).default("submitted_desc"),
}).strict();

const correction = z.object({
  target: z.enum(["ENTRY", "VARIANT"]), sourceId: dataId, sourceUrl: publicSourceUrl,
  observedAt: z.iso.datetime({ offset: true }), basis: z.enum(["REPORTED", "MEASURED", "COMMUNITY", "EXPERT"]), value: z.unknown(),
}).strict();
export const conflictSchema = z.object({
  attribute: z.enum(allAttributes),
  action: z.enum(["SELECT", "UNRESOLVED", "REJECT_OBSERVATION", "CORRECTION"]),
  claimId: dataId.optional(),
  // Every observation version the reviewer compared; any change makes the decision stale.
  claimVersions: z.record(dataId, version).refine(v => Object.keys(v).length <= 200, "Too many observations."),
  reason, sourceChecked: z.boolean().default(false), correction: correction.optional(), requestId: requestId.optional(),
}).strict().superRefine((v, ctx) => {
  if (v.action === "CORRECTION" ? !v.correction || !!v.claimId : !v.claimId || !!v.correction) ctx.addIssue({ code: "custom", message: "Choose one observation, or supply exactly one documented correction." });
  if ((v.action === "SELECT" || v.action === "CORRECTION") && !v.sourceChecked) ctx.addIssue({ code: "custom", path: ["sourceChecked"], message: "Confirm the supporting value was checked against its source." });
});

export const duplicateSchema = z.object({
  outcome: z.enum(["CONFIRM_NEW", "LINK_EXISTING", "REJECT_DUPLICATE", "INVESTIGATE"]),
  version, reviewFingerprint: fingerprint, reason,
  targetEntryId: dataId.optional(),
  importRowIds: z.array(dataId).max(50).default([]),
  requestId: requestId.optional(),
}).strict().refine(v => (v.outcome === "LINK_EXISTING") === !!v.targetEntryId, "Linking requires exactly one existing target; other outcomes take none.");

export const bulkLimit = 25;
export const bulkSchema = z.object({
  action: z.enum(["PREVIEW", "APPROVE", "REJECT"]),
  items: z.array(z.object({ id: dataId, version: version.optional(), reviewFingerprint: fingerprint.optional() }).strict()).min(1).max(bulkLimit)
    .refine(items => new Set(items.map(i => i.id)).size === items.length, "Each product may appear once."),
  reason: reason.optional(), confirmed: z.boolean().default(false), requestId: requestId.optional(),
  identityConfirmed: z.boolean().default(false), evidenceChecked: z.boolean().default(false),
}).strict().superRefine((v, ctx) => {
  if (v.action === "PREVIEW") return;
  if (!v.confirmed || !v.reason || !v.requestId) ctx.addIssue({ code: "custom", message: "Bulk changes require explicit confirmation, a reason and a request ID." });
  if (v.items.some(i => !i.version || !i.reviewFingerprint)) ctx.addIssue({ code: "custom", message: "Preview the batch first; each item needs its reviewed version and fingerprint." });
});

// D5: decide a source-sync change inside the D4 review workflow.
export const syncChangeSchema = z.object({ changeId: dataId, action: z.enum(["ACKNOWLEDGE", "DISMISS"]), reason, version, requestId: requestId.optional() }).strict();
