import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { AccessError, type Principal } from "@/lib/accounts/authorization";
import { CommunityError } from "@/lib/community/service";
import { adminTx, audit, lockProduct, requireAdmin, type Tx } from "@/lib/product-data/service";
import { claimSchema, dataId, type ProductState } from "@/lib/product-data/validation";
import { compareClaims, isExplicitUnknown } from "@/lib/product-data/comparison";
import { stableJson } from "@/lib/data-import/preview";
import { actionForStatus, conflictGroups, evaluateProduct, imageRights, lifecycleTarget, publicImageEligible, reviewFingerprint, type LifecycleAction } from "./rules";
import { loadFacts, publicSnapshot, recordRevision } from "./facts";
import { bulkSchema, conflictSchema, duplicateSchema, legacyPublicationSchema, noteSchema, reviewQuery, reviewTransitionSchema, transitionSchema, type TransitionInput } from "./contracts";

const digest = (value: unknown) => createHash("sha256").update(stableJson(value)).digest("hex");
// Request keys are scoped to the actor and product so a reused client ID cannot touch another record.
const requestKey = (actor: string, requestId: string | undefined, scope: string) => requestId ? digest(["d4", actor, scope, requestId]) : null;
export type PublicChange = { slug: string; changed: boolean };

async function factsFor(tx: Tx, id: string) {
  const found = (await loadFacts(tx, [id])).get(id);
  if (!found) throw new CommunityError(404, "Product not found.");
  return { ...found, evaluation: evaluateProduct(found.facts), fingerprint: reviewFingerprint(found.facts) };
}
/** Replay a committed decision for the same intent; refuse the same key with a different payload. */
async function replay(tx: Tx, key: string | null, hash: string) {
  if (!key) return null;
  const existing = await tx.productReviewDecision.findUnique({ where: { requestKey: key }, select: { id: true, kind: true, requestHash: true, entryId: true } });
  if (!existing) return null;
  if (existing.requestHash !== hash) throw new CommunityError(409, "This request ID was already used for a different decision.");
  return existing;
}

async function applyTransition(tx: Tx, user: Principal, id: string, input: TransitionInput, opts: { requireFingerprint: boolean }) {
  dataId.parse(id);
  await lockProduct(tx, id);
  const key = requestKey(user.id, input.requestId, id), hash = digest({ id, ...input });
  const replayed = await replay(tx, key, hash);
  const current = await factsFor(tx, id);
  const entry = current.entry;
  if (replayed) return { replayed: true, entry: { id, slug: entry.slug, status: entry.status, version: entry.version }, decisionId: replayed.id, publicChanged: false };
  if (entry.version !== input.version) throw new CommunityError(409, "This product changed since you opened it. Reload and review the current record.");
  const target = lifecycleTarget(input.action, entry.status);
  if (!target) throw new CommunityError(409, `“${input.action.toLowerCase()}” is not allowed from ${entry.status.replace("_", " ").toLowerCase()}.`);
  if (opts.requireFingerprint || input.reviewFingerprint) {
    if (input.reviewFingerprint !== current.fingerprint) throw new CommunityError(409, "Evidence, images or duplicates changed since you reviewed this product. Reload and review again.");
  }
  const { evaluation } = current;
  if (input.action === "APPROVE") {
    if (evaluation.readiness !== "READY_FOR_APPROVAL") throw new CommunityError(400, `Publication blocked: ${evaluation.issues.filter(i => i.severity === "BLOCKING_ERROR").map(i => i.code).join(", ")}.`);
    if (!input.identityConfirmed || !input.evidenceChecked) throw new CommunityError(400, "Confirm the exact identity and that critical evidence was checked against its sources.");
  }
  if ((input.action === "SUBMIT" || input.action === "RESUBMIT") && evaluation.readiness === "BLOCKED")
    throw new CommunityError(400, `Fix blocking identity/source problems before review: ${evaluation.issues.filter(i => i.severity === "BLOCKING_ERROR").map(i => i.code).join(", ")}.`);
  const updated = await tx.catalogueEntry.update({ where: { id }, data: { status: target, version: { increment: 1 }, ...(target === "PENDING_REVIEW" ? { submittedAt: new Date() } : {}) }, select: { id: true, slug: true, status: true, version: true, published: true } });
  const decision = await tx.productReviewDecision.create({ data: {
    entryId: id, entryKey: id, actorId: user.id, kind: input.action, fromStatus: entry.status, toStatus: target, reason: input.reason, entryVersion: entry.version,
    reviewFingerprint: current.fingerprint, requestKey: key, requestHash: key ? hash : null,
    details: { readiness: evaluation.readiness, blocking: evaluation.issues.filter(i => i.severity === "BLOCKING_ERROR").map(i => i.code), warnings: evaluation.issues.filter(i => i.severity === "WARNING").map(i => i.code), ...(input.action === "APPROVE" ? { identityConfirmed: true, evidenceChecked: true } : {}) },
  } });
  await audit(tx, user, `PRODUCT:${id}`, "PRODUCT_STATUS", `${entry.status} → ${target}: ${input.reason}`.slice(0, 1000));
  if (target === "PUBLISHED") await recordRevision(tx, [id], user.id, input.reason, decision.id, true);
  return { replayed: false, entry: updated, decisionId: decision.id, publicChanged: target === "PUBLISHED" || entry.status === "PUBLISHED" };
}

export async function transitionProduct(actor: Principal | null, id: string, raw: unknown) {
  const input = reviewTransitionSchema.parse(raw);
  return adminTx(actor, (tx, user) => applyTransition(tx, user, id, input, { requireFingerprint: input.action === "APPROVE" }));
}
/** D1 PATCH contract, now enforced by the same D4 rules (revalidation, attestation, audit). */
export async function legacyTransition(actor: Principal | null, id: string, raw: unknown) {
  const data = legacyPublicationSchema.parse(raw);
  return adminTx(actor, async (tx, user) => {
    const current = await tx.catalogueEntry.findUnique({ where: { id: dataId.parse(id) }, select: { status: true } });
    if (!current) throw new CommunityError(404, "Product not found.");
    const action = actionForStatus(current.status, data.status);
    if (!action) throw new CommunityError(409, "Invalid publication transition; submit the draft for review first.");
    const input = transitionSchema.parse({ action, version: data.version, reason: data.note, identityConfirmed: data.identityConfirmed, evidenceChecked: data.evidenceChecked });
    const result = await applyTransition(tx, user, id, input, { requireFingerprint: false });
    return { ...(await tx.catalogueEntry.findUniqueOrThrow({ where: { id } })), publicChanged: result.publicChanged };
  });
}

export async function addReviewNote(actor: Principal | null, id: string, raw: unknown) {
  const input = noteSchema.parse(raw);
  return adminTx(actor, async (tx, user) => {
    await lockProduct(tx, dataId.parse(id));
    const key = requestKey(user.id, input.requestId, `note:${id}`), hash = digest({ id, ...input });
    const replayed = await replay(tx, key, hash);
    if (replayed) return { id: replayed.id, replayed: true };
    const entry = await tx.catalogueEntry.findUniqueOrThrow({ where: { id }, select: { version: true } });
    if (entry.version !== input.version) throw new CommunityError(409, "This product changed. Reload before adding notes.");
    const row = await tx.productReviewDecision.create({ data: { entryId: id, entryKey: id, actorId: user.id, kind: "NOTE", reason: input.note, entryVersion: entry.version, requestKey: key, requestHash: key ? hash : null } });
    await audit(tx, user, `PRODUCT:${id}`, "PRODUCT_NOTE", "Private review note recorded.");
    return { id: row.id, replayed: false };
  });
}

/** Resolve contradictory evidence. Observations are never deleted or edited; only their review state changes. */
export async function resolveConflict(actor: Principal | null, id: string, raw: unknown) {
  const input = conflictSchema.parse(raw);
  return adminTx(actor, async (tx, user) => {
    await lockProduct(tx, dataId.parse(id));
    const key = requestKey(user.id, input.requestId, `conflict:${id}`), hash = digest({ id, ...input });
    const replayed = await replay(tx, key, hash);
    const current = await factsFor(tx, id);
    if (replayed) return { replayed: true, decisionId: replayed.id, slug: current.entry.slug, publicChanged: false };
    const entry = current.entry;
    const group = current.claims.filter(c => c.attribute === input.attribute);
    const seen = input.claimVersions;
    if (group.length !== Object.keys(seen).length || group.some(c => seen[c.id] !== c.version)) throw new CommunityError(409, "Observations for this attribute changed since you compared them. Reload and compare again.");
    const before = group.map(c => ({ id: c.id, status: c.status, value: c.value, sourceId: c.sourceId, sourceUrl: c.sourceUrl, sourceType: c.source.type, basis: c.basis, observedAt: c.observedAt.toISOString() }));
    const note = `Conflict resolution: ${input.reason}`.slice(0, 1000);
    const changes: { id: string; from: string; to: string }[] = [];
    const setState = async (claimId: string, to: "VERIFIED" | "REJECTED" | "CONFLICTED" | "PENDING_REVIEW", from: string) => {
      await tx.productClaim.update({ where: { id: claimId }, data: { status: to, reviewerId: user.id, reviewNote: note, reviewedAt: to === "VERIFIED" ? new Date() : null, version: { increment: 1 } } });
      changes.push({ id: claimId, from, to });
    };
    let selected: { id: string; value: unknown; sourceId: string; sourceUrl: string; basis: string; source: { type: string } } | null = null;
    if (input.action === "CORRECTION") {
      const c = input.correction!;
      const parsed = claimSchema.parse({ ...(c.target === "ENTRY" ? { entryId: id } : { variantId: entry.outsoleVariantId }), attribute: input.attribute, value: c.value, basis: c.basis, sourceId: c.sourceId, sourceUrl: c.sourceUrl, observedAt: c.observedAt, notes: `Administrator correction: ${input.reason}`.slice(0, 1000) });
      const created = await tx.productClaim.create({ data: { ...parsed, observedAt: new Date(parsed.observedAt), value: parsed.value as Prisma.InputJsonValue }, include: { source: { select: { type: true } } } });
      changes.push({ id: created.id, from: "NEW", to: "UNVERIFIED" });
      selected = created;
    } else {
      const claim = group.find(c => c.id === input.claimId);
      if (!claim) throw new CommunityError(404, "That observation does not belong to this attribute and product.");
      if (claim.status === "REJECTED" && input.action !== "SELECT") throw new CommunityError(409, "This observation is already rejected.");
      if (input.action === "UNRESOLVED") { if (claim.status !== "CONFLICTED") await setState(claim.id, "CONFLICTED", claim.status); }
      else if (input.action === "REJECT_OBSERVATION") await setState(claim.id, "REJECTED", claim.status);
      else selected = claim;
    }
    if (selected) {
      const source = await tx.productSource.findUnique({ where: { id: selected.sourceId } });
      if (!source || source.status !== "ACTIVE" || source.authorizationStatus === "DENIED") throw new CommunityError(400, "The selected value must cite an active, permitted source.");
      if (source.type === "MANUFACTURER" && source.brandId !== current.facts.brand?.id) throw new CommunityError(400, "Manufacturer source belongs to a different brand.");
      if (source.type === "MANUFACTURER" && new URL(selected.sourceUrl).hostname !== new URL(source.baseUrl).hostname) throw new CommunityError(400, "Manufacturer evidence URL must match its registered origin.");
      if (isExplicitUnknown(selected.value)) throw new CommunityError(400, "An explicit unknown cannot be selected as a supported value.");
      const original = group.find(c => c.id === selected!.id);
      if (original && !claimSchema.safeParse({ ...(original.entryId ? { entryId: original.entryId } : { variantId: original.variantId }), attribute: input.attribute, value: original.value, basis: original.basis, sourceId: original.sourceId, sourceUrl: original.sourceUrl, observedAt: new Date(0).toISOString() }).success)
        throw new CommunityError(400, "The selected observation is malformed and cannot be verified.");
      // Contradicting observations stay on record as REJECTED; equivalent or different-context ones are untouched.
      for (const other of group) {
        if (other.id === selected.id || other.status === "REJECTED") continue;
        const relation = compareClaims(input.attribute, other.value, selected.value);
        if (relation === "CONFLICT") await setState(other.id, "REJECTED", other.status);
        else if (other.status === "CONFLICTED") await setState(other.id, "PENDING_REVIEW", other.status);
      }
      const from = group.find(c => c.id === selected.id)?.status ?? "UNVERIFIED";
      if (from !== "VERIFIED") await setState(selected.id, "VERIFIED", from);
    }
    // Construction-level (variant) evidence is shared by every colorway of this variant.
    const variantTouched = changes.some(ch => { const c = current.claims.find(x => x.id === ch.id); return c ? !!c.variantId : input.correction?.target === "VARIANT"; });
    const decision = await tx.productReviewDecision.create({ data: {
      entryId: id, entryKey: id, actorId: user.id, kind: "CONFLICT_RESOLUTION", reason: input.reason, entryVersion: entry.version, reviewFingerprint: current.fingerprint, requestKey: key, requestHash: key ? hash : null,
      details: { attribute: input.attribute, action: input.action, previous: before.filter(b => b.status === "VERIFIED").map(b => ({ id: b.id, value: b.value })), selected: selected ? { id: selected.id, value: selected.value, sourceId: selected.sourceId, sourceUrl: selected.sourceUrl, sourceType: selected.source.type, basis: selected.basis } : null, changes, observations: before } as Prisma.InputJsonValue,
    } });
    await audit(tx, user, `PRODUCT:${id}`, "RESOLVE_CONFLICT", `${input.attribute}: ${input.action}`);
    const affected = [id, ...(variantTouched ? (await tx.catalogueEntry.findMany({ where: { outsoleVariantId: entry.outsoleVariantId, status: "PUBLISHED" }, select: { id: true }, take: 100 })).map(e => e.id) : [])];
    const revised = await recordRevision(tx, affected, user.id, `Evidence change (${input.attribute}): ${input.reason}`, decision.id);
    return { replayed: false, decisionId: decision.id, changes, slug: entry.slug, publicChanged: revised.length > 0 };
  });
}

/** Never merges records. LINK_EXISTING retires a never-published draft and points its source mappings at the exact existing product. */
export async function resolveDuplicate(actor: Principal | null, id: string, raw: unknown) {
  const input = duplicateSchema.parse(raw);
  return adminTx(actor, async (tx, user) => {
    await lockProduct(tx, dataId.parse(id));
    const key = requestKey(user.id, input.requestId, `duplicate:${id}`), hash = digest({ id, ...input });
    const replayed = await replay(tx, key, hash);
    const current = await factsFor(tx, id);
    if (replayed) return { replayed: true, decisionId: replayed.id };
    const { entry, facts } = current;
    if (entry.version !== input.version || current.fingerprint !== input.reviewFingerprint) throw new CommunityError(409, "This product or its duplicate candidates changed. Reload and review again.");
    const risky = facts.duplicates.filter(d => (d.relation === "SAME_IDENTITY" || d.relation === "CASE_ONLY_SKU") && d.status !== "REJECTED");
    const staged = await tx.productImportRow.findMany({ where: { id: { in: input.importRowIds }, entryId: id, action: { in: ["STAGE", "QUARANTINE"] } }, select: { id: true } });
    if (staged.length !== input.importRowIds.length) throw new CommunityError(400, "Some staged rows do not belong to this product.");
    let toStatus: ProductState | null = null, moved = 0;
    if (input.outcome === "LINK_EXISTING" || input.outcome === "REJECT_DUPLICATE") {
      if (!["DRAFT", "PENDING_REVIEW"].includes(entry.status) || entry.slugLocked) throw new CommunityError(409, "Only never-published drafts or pending submissions can be retired as duplicates. Published URLs and their reviews keep their identity.");
      toStatus = "REJECTED";
    }
    if (input.outcome === "LINK_EXISTING") {
      // Only an exact same-identity candidate qualifies; tier, outsole, generation or colorway differences never link.
      const target = facts.duplicates.find(d => d.candidateId === input.targetEntryId && d.relation === "SAME_IDENTITY" && d.status !== "REJECTED");
      if (!target) throw new CommunityError(400, "Link only to an existing product with the exact same brand, family, generation, tier, outsole and colorway.");
      await tx.$queryRaw`SELECT id FROM "CatalogueEntry" WHERE id=${target.candidateId} FOR UPDATE`;
      moved = (await tx.productSourceRecord.updateMany({ where: { entryId: id }, data: { entryId: target.candidateId } })).count;
    }
    if (toStatus) await tx.catalogueEntry.update({ where: { id }, data: { status: toStatus, version: { increment: 1 } } });
    else await tx.catalogueEntry.update({ where: { id }, data: { version: { increment: 1 } } });
    const decision = await tx.productReviewDecision.create({ data: {
      entryId: id, entryKey: id, actorId: user.id, kind: "DUPLICATE_RESOLUTION", fromStatus: toStatus ? entry.status : null, toStatus, reason: input.reason, entryVersion: entry.version, reviewFingerprint: current.fingerprint, requestKey: key, requestHash: key ? hash : null,
      details: { outcome: input.outcome, candidateIds: risky.map(d => d.candidateId), candidates: facts.duplicates, targetEntryId: input.targetEntryId ?? null, movedSourceRecords: moved, importRowIds: input.importRowIds },
    } });
    await audit(tx, user, `PRODUCT:${id}`, "RESOLVE_DUPLICATE", `${input.outcome}${input.targetEntryId ? ` → ${input.targetEntryId}` : ""}: ${input.reason}`.slice(0, 1000));
    return { replayed: false, decisionId: decision.id, status: toStatus ?? entry.status, movedSourceRecords: moved };
  });
}

export async function reviewDetail(actor: Principal | null, id: string) {
  return adminTx(actor, async tx => {
    const current = await factsFor(tx, dataId.parse(id));
    const { entry, facts, evaluation } = current;
    const [history, revisions, staged, sources, preview] = await Promise.all([
      tx.productReviewDecision.findMany({ where: { entryId: id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50, select: { id: true, kind: true, fromStatus: true, toStatus: true, reason: true, details: true, createdAt: true, actor: { select: { id: true, name: true, email: true } } } }),
      tx.productRevision.findMany({ where: { entryId: id }, orderBy: { revision: "desc" }, take: 20, select: { id: true, revision: true, snapshot: true, snapshotHash: true, reason: true, createdAt: true, actor: { select: { name: true, email: true } } } }),
      tx.productImportRow.findMany({ where: { entryId: id, action: { in: ["STAGE", "QUARANTINE"] } }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, outcome: true, action: true, diagnostics: true, sourceUrl: true, observedAt: true, createdAt: true, batch: { select: { id: true, source: { select: { name: true } } } } } }),
      tx.productSource.findMany({ where: { status: "ACTIVE", authorizationStatus: { not: "DENIED" } }, select: { id: true, name: true, type: true }, orderBy: { name: "asc" }, take: 100 }),
      publicSnapshot(tx, id),
    ]);
    const candidateIds = facts.duplicates.map(d => d.candidateId);
    const candidates = candidateIds.length ? await tx.catalogueEntry.findMany({ where: { id: { in: candidateIds } }, select: { id: true, slug: true, status: true, variant: { select: { surface: true, tier: { select: { name: true, generation: { select: { name: true } } } } } }, colorway: { select: { name: true } }, _count: { select: { posts: true } } } }) : [];
    const groups = conflictGroups(facts.claims).map(g => ({ attribute: g.attribute, claims: g.claims.map(c => ({ ...c, observedAt: c.observedAt.toISOString(), reviewedAt: c.reviewedAt?.toISOString() ?? null, scope: c.entryId ? "ENTRY" : "VARIANT" })) }));
    const pending = facts.claims.filter(c => c.status !== "VERIFIED" && c.status !== "REJECTED");
    const reviewsOnVariant = (await tx.catalogueEntry.findUniqueOrThrow({ where: { id }, select: { variant: { select: { _count: { select: { reviews: true } } } } } })).variant._count.reviews;
    return {
      id, slug: entry.slug, status: entry.status, version: entry.version, sample: entry.sample, submittedAt: entry.submittedAt, createdAt: entry.createdAt, updatedAt: entry.updatedAt, slugLocked: entry.slugLocked,
      identity: { brand: facts.brand?.name, family: facts.family?.name, generation: facts.generation?.name, tier: facts.tier?.name, outsole: facts.variant?.surface ?? null, manufacturerOutsole: facts.variant?.manufacturerOutsole ?? null, colorway: facts.colorway?.name, swatch: facts.colorway?.swatch ?? null, variantId: entry.outsoleVariantId, identifiers: facts.identifiers, reviewsOnVariant },
      source: entry.source && { id: entry.source.id, name: entry.source.name, type: entry.source.type, baseUrl: entry.source.baseUrl, authorizationStatus: entry.source.authorizationStatus, usageRestrictions: entry.source.usageRestrictions, permissionUrl: entry.source.permissionUrl, lastCheckedAt: entry.source.lastCheckedAt, status: entry.source.status },
      evaluation, fingerprint: current.fingerprint,
      claims: facts.claims.map(c => ({ id: c.id, version: c.version, attribute: c.attribute, value: c.value, status: c.status, basis: c.basis, scope: c.entryId ? "ENTRY" : "VARIANT", sourceUrl: c.sourceUrl, observedAt: c.observedAt.toISOString(), reviewedAt: c.reviewedAt?.toISOString() ?? null, source: c.source })),
      conflicts: groups,
      images: facts.images.map(i => ({ id: i.id, altText: i.altText, attribution: i.attribution, sourceUrl: i.sourceUrl, isPrimary: i.isPrimary, status: i.status, licenseStatus: i.licenseStatus, permissionUrl: i.permissionUrl, rights: imageRights(i), publicEligible: publicImageEligible(i), src: i.uploadedImageId ? `/api/images/${i.uploadedImageId}` : null, externalUrl: i.externalUrl, usageRestrictions: i.source.usageRestrictions })),
      duplicates: facts.duplicates.map(d => ({ ...d, detail: candidates.find(c => c.id === d.candidateId) ?? null })),
      duplicateDecision: facts.duplicateDecision, staged,
      published: revisions[0] ?? null, preview: preview.snapshot, previewChanged: revisions[0] ? revisions[0].snapshotHash !== preview.hash : null,
      proposed: pending.map(c => ({ id: c.id, attribute: c.attribute, value: c.value, status: c.status, sourceName: c.source.name, sourceType: c.source.type, sourceUrl: c.sourceUrl })),
      history: history.map(h => ({ ...h, actor: h.actor ? { id: h.actor.id, name: h.actor.name ?? h.actor.email } : null })), revisions: revisions.map(r => ({ ...r, actor: r.actor ? r.actor.name ?? r.actor.email : null })), sources,
    };
  });
}

const searchable = (q: string): Prisma.CatalogueEntryWhereInput => {
  const value = q.replace(/[\\%_]/g, "\\$&"), contains = { contains: value, mode: "insensitive" as const };
  return { OR: [{ slug: contains }, { identifiers: { some: { value: contains } } }, { colorway: { name: contains } }, { variant: { tier: { OR: [{ name: contains }, { generation: { OR: [{ name: contains }, { family: { OR: [{ name: contains }, { brand: { name: contains } }] } }] } }] } } }] };
};
export async function listReviewQueue(actor: Principal | null, raw: unknown) {
  const q = reviewQuery.parse(raw);
  return adminTx(actor, async tx => {
    const quality: Record<string, Prisma.CatalogueEntryWhereInput> = {
      conflicts: { OR: [{ claims: { some: { status: "CONFLICTED" } } }, { variant: { claims: { some: { status: "CONFLICTED" } } } }] },
      missing_image: { productImages: { none: { status: "VERIFIED", licenseStatus: "GRANTED" } } },
      missing_sku: { identifiers: { none: {} } }, unknown_outsole: { variant: { surface: null } },
      staged_proposals: { importRows: { some: { action: { in: ["STAGE", "QUARANTINE"] } } } },
    };
    const where: Prisma.CatalogueEntryWhereInput = { AND: [q.status ? { status: q.status } : {}, q.sourceId ? { sourceId: q.sourceId } : {}, q.q ? searchable(q.q) : {}, q.quality ? quality[q.quality] : {}] };
    const orderBy: Prisma.CatalogueEntryOrderByWithRelationInput[] = q.sort === "submitted_asc" ? [{ submittedAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }, { id: "asc" }] : q.sort === "created_desc" ? [{ createdAt: "desc" }, { id: "asc" }] : q.sort === "updated_desc" ? [{ updatedAt: "desc" }, { id: "asc" }] : [{ submittedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }, { id: "asc" }];
    const [total, rows] = await Promise.all([tx.catalogueEntry.count({ where }), tx.catalogueEntry.findMany({ where, orderBy, take: 25, skip: (q.page - 1) * 25, select: { id: true } })]);
    const facts = await loadFacts(tx, rows.map(r => r.id));
    const records = rows.flatMap(({ id }) => {
      const f = facts.get(id); if (!f) return [];
      const evaluation = evaluateProduct(f.facts), e = f.entry;
      return [{
        id, slug: e.slug, status: e.status, version: e.version, sample: e.sample, submittedAt: e.submittedAt, createdAt: e.createdAt,
        identity: { brand: f.facts.brand?.name, family: f.facts.family?.name, generation: f.facts.generation?.name, tier: f.facts.tier?.name, outsole: f.facts.variant?.surface ?? null, colorway: f.facts.colorway?.name, sku: f.facts.identifiers.slice(0, 3).map(s => s.value) },
        source: e.source && { id: e.source.id, name: e.source.name, type: e.source.type },
        readiness: evaluation.readiness, counts: evaluation.counts, fingerprint: reviewFingerprint(f.facts),
        conflicts: evaluation.issues.filter(i => i.dimension === "CONFLICTS" && i.severity !== "INFORMATION").length,
        missingOptional: evaluation.issues.some(i => i.code === "missing_optional_specifications"),
        imageStatus: evaluation.eligibleImages ? "AUTHORIZED" : f.facts.images.length ? "PENDING_OR_DENIED" : "NONE",
        topIssues: evaluation.issues.filter(i => i.severity !== "INFORMATION").slice(0, 3).map(i => ({ code: i.code, severity: i.severity, message: i.message })),
      }];
    });
    return { records, total, page: q.page, pages: Math.max(1, Math.ceil(total / 25)) };
  });
}

export async function reviewDashboard(actor: Principal | null) {
  return adminTx(actor, async tx => {
    const [byStatus, conflicts, duplicates, missingImages, staged, sources] = await Promise.all([
      tx.catalogueEntry.groupBy({ by: ["status"], _count: { _all: true } }),
      tx.$queryRaw<{ n: number }[]>`SELECT count(DISTINCT e.id)::int AS n FROM "CatalogueEntry" e WHERE e.status<>'REJECTED' AND EXISTS (SELECT 1 FROM "ProductClaim" c WHERE c.status='CONFLICTED' AND (c."entryId"=e.id OR c."variantId"=e."outsoleVariantId"))`,
      tx.$queryRaw<{ n: number }[]>`
        WITH ident AS (SELECT e.id, e.status, b.id bid, lower(regexp_replace(btrim(normalize(f.name,NFC)),'\\s+',' ','g')) fam, lower(regexp_replace(btrim(normalize(g.name,NFC)),'\\s+',' ','g')) gen, lower(regexp_replace(btrim(normalize(t.name,NFC)),'\\s+',' ','g')) tier, v.surface, lower(regexp_replace(btrim(normalize(c.name,NFC)),'\\s+',' ','g')) color
          FROM "CatalogueEntry" e JOIN "BootVariant" v ON v.id=e."outsoleVariantId" JOIN "BootTier" t ON t.id=v."tierModelId" JOIN "BootGeneration" g ON g.id=e."generationId" JOIN "BootFamily" f ON f.id=g."familyId" JOIN "BootBrand" b ON b.id=f."brandId" JOIN "BootColorway" c ON c.id=e."colorwayId" WHERE e.status<>'REJECTED')
        -- Group, not self-join: a large same-identity group would otherwise be quadratic (13.4 s → 30 ms at 6,000 rows).
        SELECT coalesce(sum(n),0)::int AS n FROM (SELECT count(*) AS n FROM ident GROUP BY bid,fam,gen,tier,surface,color HAVING count(*)>1) g`,
      tx.catalogueEntry.count({ where: { status: { not: "REJECTED" }, productImages: { none: { status: "VERIFIED", licenseStatus: "GRANTED" } } } }),
      tx.productImportRow.count({ where: { action: { in: ["STAGE", "QUARANTINE"] }, outcome: { in: ["POSSIBLE_MATCH", "CONFLICT"] } } }),
      tx.productSource.findMany({ where: { entries: { some: {} } }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 100 }),
    ]);
    const statuses = Object.fromEntries(["DRAFT", "PENDING_REVIEW", "PUBLISHED", "REJECTED", "ARCHIVED"].map(s => [s, byStatus.find(r => r.status === s)?._count._all ?? 0]));
    return { statuses, unresolvedConflicts: conflicts[0]?.n ?? 0, possibleDuplicates: duplicates[0]?.n ?? 0, missingAuthorizedImages: missingImages, stagedImportMatches: staged, sources };
  });
}

type BulkOutcome = { id: string; outcome: "APPROVED" | "REJECTED" | "ALREADY_APPLIED" | "SKIPPED_BLOCKED" | "SKIPPED_STALE" | "SKIPPED_STATUS" | "NOT_FOUND" | "FAILED"; message: string; readiness?: string; blocking?: string[]; slug?: string };
/** Each item commits in its own short transaction: no unbounded batch lock, and every outcome is reported. */
export async function bulkReview(actor: Principal | null, raw: unknown) {
  const input = bulkSchema.parse(raw);
  requireAdmin(actor);
  if (input.action === "PREVIEW") {
    return adminTx(actor, async tx => {
      const facts = await loadFacts(tx, input.items.map(i => i.id));
      return { action: "PREVIEW", results: input.items.map(({ id }) => {
        const f = facts.get(id); if (!f) return { id, outcome: "NOT_FOUND" as const, message: "Product not found." };
        const e = evaluateProduct(f.facts);
        return { id, slug: f.entry.slug, status: f.entry.status, version: f.entry.version, fingerprint: reviewFingerprint(f.facts), readiness: e.readiness, eligible: f.entry.status === "PENDING_REVIEW" && e.readiness === "READY_FOR_APPROVAL", blocking: e.issues.filter(i => i.severity === "BLOCKING_ERROR").map(i => i.message), warnings: e.counts.warnings };
      }) };
    });
  }
  const results: BulkOutcome[] = [];
  for (const item of input.items) {
    const action: LifecycleAction = input.action === "APPROVE" ? "APPROVE" : "REJECT";
    try {
      const r = await adminTx(actor, (tx, user) => applyTransition(tx, user, item.id, transitionSchema.parse({ action, version: item.version, reason: input.reason, reviewFingerprint: item.reviewFingerprint, requestId: `${input.requestId!.slice(0, 40)}-${createHash("sha256").update(item.id).digest("hex").slice(0, 16)}`, identityConfirmed: input.identityConfirmed, evidenceChecked: input.evidenceChecked }), { requireFingerprint: true }));
      results.push({ id: item.id, slug: r.entry.slug, outcome: r.replayed ? "ALREADY_APPLIED" : action === "APPROVE" ? "APPROVED" : "REJECTED", message: r.replayed ? "Already applied by this request." : action === "APPROVE" ? "Published." : "Rejected." });
    } catch (error) {
      if (error instanceof AccessError) throw error;
      const message = error instanceof CommunityError ? error.message : "Unexpected failure; nothing was changed for this product.";
      const status = error instanceof CommunityError ? error.status : 500;
      results.push({ id: item.id, outcome: status === 404 ? "NOT_FOUND" : status === 400 ? "SKIPPED_BLOCKED" : status === 409 && /not allowed/.test(message) ? "SKIPPED_STATUS" : status === 409 ? "SKIPPED_STALE" : "FAILED", message });
    }
  }
  const counts = results.reduce<Record<string, number>>((n, r) => ({ ...n, [r.outcome]: (n[r.outcome] ?? 0) + 1 }), {});
  return { action: input.action, results, counts };
}
