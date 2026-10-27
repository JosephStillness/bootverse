import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { collectFeed, FeedFailure } from "@/lib/data-import/adapter";
import { prepareImport, stableJson, type PreparedImport } from "@/lib/data-import/preview";
import { readGraph } from "@/lib/data-import/snapshot";
import { persistPlan } from "@/lib/data-import/persist";
import { ImportInputError, importLimits } from "@/lib/data-import/types";
import { localImportsOnly } from "@/lib/data-import/service";
import { prepareEnrichment } from "@/lib/enrichment/plan";
import { persist as persistEnrichment } from "@/lib/enrichment/service";
import { publicAssets } from "@/lib/enrichment/public";
import { legacyObservations } from "@/lib/product-data/legacy";
import { adapterFor, isRegistered, type SyncAdapter } from "./adapters";
import { splitRecords, redact } from "./feed";
import { detectChanges, outcomeOf, type ExistingEntry } from "./detect";
import { diffOffer, formatCents, normalizeOffer, publishesPrice, type IncomingOffer } from "./offers";
import { backoffMs, eligibility, fieldPolicy, syncConfig, type ErrorCategory, type Trigger } from "./policy";
import { alertAfterFailure, alertsAfterSuccess, sweepAlerts } from "./alert-rules";
import { logNotifier, raiseAlert, resolveAlerts, type AlertNotifier } from "./alerts";

type Tx = Prisma.TransactionClient;
export type EntryPoint = "scheduler" | "cli" | "admin" | "internal_endpoint";
export type RunOptions = {
  sourceId: string; trigger: Trigger; entryPoint: EntryPoint; mode?: "RUN" | "PREVIEW"; actorId?: string | null; requestId?: string;
  owner?: string; signal?: AbortSignal; now?: Date; env?: Record<string, string | undefined>; notifier?: AlertNotifier; random?: () => number;
};
export type RunResult =
  | { status: "SKIPPED"; reason: string; jobId?: string }
  | { status: "SUCCEEDED" | "FAILED" | "CANCELLED"; jobId: string; mode: "RUN" | "PREVIEW"; summary: Record<string, unknown>; errorCategory?: string; preview?: unknown };

const DATA_WRITER_LOCK = 734982165; // shared with D2 imports and D3 enrichment: one catalogue writer at a time
const detail: Record<string, string> = {
  AUTHORIZATION: "Provider rejected the configured credentials or permission.", NOT_PERMITTED: "Source is not authorized for automated access.", CONFIG: "Adapter or feed configuration is invalid or unavailable.",
  TIMEOUT: "Provider request timed out.", UNAVAILABLE: "Provider was unavailable.", RATE_LIMITED: "Provider rate limit; retry after the requested delay.",
  INVALID_FEED: "Feed was malformed or failed validation.", PARTIAL_FEED: "Feed was incomplete.", DATABASE: "Database was unavailable; nothing was committed.",
  STORAGE: "Storage was unavailable.", BUSY: "Another catalogue writer was running; retried shortly.", WORKER_LOST: "The worker lease expired before completion.",
  CANCELLED: "Run was cancelled before committing.", INTERNAL: "Unexpected failure; nothing was committed.",
};
class SyncError extends Error { constructor(public category: ErrorCategory, public retryAfterMs = 0) { super(detail[category]); } }

function log(event: string, fields: Record<string, unknown>) {
  // Structured, allowlisted fields only: never payloads, URLs with queries, or credentials.
  console.log(JSON.stringify({ event, ...fields }));
}
export function classify(error: unknown): { category: ErrorCategory; retryAfterMs: number } {
  if (error instanceof SyncError) return { category: error.category, retryAfterMs: error.retryAfterMs };
  if (error instanceof FeedFailure) return { category: error.category as ErrorCategory, retryAfterMs: error.retryAfterMs };
  if (error instanceof ImportInputError) return { category: "INVALID_FEED", retryAfterMs: 0 };
  if (error instanceof Prisma.PrismaClientKnownRequestError) return { category: ["P2002", "P2034"].includes(error.code) ? "BUSY" : "DATABASE", retryAfterMs: 0 };
  if (error instanceof Prisma.PrismaClientInitializationError || error instanceof Prisma.PrismaClientRustPanicError || error instanceof Prisma.PrismaClientUnknownRequestError) return { category: "DATABASE", retryAfterMs: 0 };
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string" && ["ECONNREFUSED", "ETIMEDOUT", "P1001", "P1002", "P1017"].includes(code)) return { category: "DATABASE", retryAfterMs: 0 };
  return { category: "INTERNAL", retryAfterMs: 0 };
}

/** Scheduled runs share one key per interval window, so duplicate triggers in that window are no-ops. */
function idempotencyKey(o: RunOptions, interval: number | null, now: Date) {
  if (o.trigger === "SCHEDULED") { const minutes = interval ?? 1440; return `sched:${minutes}:${Math.floor(now.getTime() / (minutes * 60_000))}`; }
  if (!o.requestId || !/^[A-Za-z0-9_-]{8,64}$/.test(o.requestId)) throw new SyncError("CONFIG");
  return `${o.mode === "PREVIEW" ? "preview" : "manual"}:${o.requestId}`;
}

async function claim(o: Required<Pick<RunOptions, "owner">> & RunOptions, now: Date, config: ReturnType<typeof syncConfig>, env: Record<string, string | undefined>) {
  const db = getDb();
  try {
    return await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "ProductSource" WHERE id=${o.sourceId} FOR UPDATE`;
      const source = await tx.productSource.findUnique({ where: { id: o.sourceId } });
      if (!source) return { skip: "SOURCE_NOT_FOUND" as const };
      // Recover leases left by crashed or killed workers so a lock never stays stuck.
      const lost = await tx.sourceSyncJob.updateMany({ where: { sourceId: source.id, status: "RUNNING", leaseExpiresAt: { lt: now } }, data: { status: "ABANDONED", completedAt: now, errorCategory: "WORKER_LOST", errorDetail: detail.WORKER_LOST } });
      if (lost.count) await tx.productSource.update({ where: { id: source.id }, data: { syncFailureCount: { increment: 1 }, lastSyncErrorCategory: "WORKER_LOST" } });
      if (await tx.sourceSyncJob.findFirst({ where: { sourceId: source.id, status: "RUNNING" }, select: { id: true } })) return { skip: "ALREADY_RUNNING" as const };
      const state = { ...source, syncFailureCount: source.syncFailureCount + lost.count };
      const verdict = eligibility(state, o.trigger, now, config, key => isRegistered(key, env));
      if (!verdict.eligible) return { skip: verdict.reason };
      const key = idempotencyKey(o, source.syncIntervalMinutes, now);
      const previous = await tx.sourceSyncJob.findUnique({ where: { sourceId_idempotencyKey: { sourceId: source.id, idempotencyKey: key } }, select: { id: true } });
      if (previous) return { skip: "DUPLICATE_REQUEST" as const, jobId: previous.id };
      const job = await tx.sourceSyncJob.create({ data: { sourceId: source.id, trigger: o.trigger, entryPoint: o.entryPoint, mode: o.mode ?? "RUN", actorId: o.actorId ?? null, idempotencyKey: key, leaseOwner: o.owner, leaseExpiresAt: new Date(now.getTime() + config.leaseMinutes * 60_000), startedAt: now, heartbeatAt: now } });
      await tx.productSource.update({ where: { id: source.id }, data: { lastSyncAttemptAt: now } });
      return { job, source };
    });
  } catch (error) {
    // The partial unique index is the cross-instance lock: a concurrent claim loses cleanly.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { skip: "ALREADY_RUNNING" as const };
    throw error;
  }
}

async function existingState(tx: Tx, entryIds: string[]) {
  const map = new Map<string, ExistingEntry & { variantId: string; version: number; targetClaims: { id: string; attribute: string; value: unknown; status: string; sourceUrl: string; observationKey: string | null }[]; targetImages: { assetKey: string | null; externalUrl: string | null; uploadedImageId: string | null; isPrimary: boolean }[] }>();
  if (!entryIds.length) return map;
  const entries = await tx.catalogueEntry.findMany({ where: { id: { in: entryIds } }, select: { id: true, version: true, sample: true, specifications: true, outsoleVariantId: true, variant: { select: { surface: true } }, identifiers: { select: { value: true, region: true }, take: 201 }, productImages: { take: 51, include: { source: { select: { status: true, authorizationStatus: true } }, uploadedImage: { select: { width: true, height: true, state: true, status: true } } } } } });
  const variantIds = [...new Set(entries.map(e => e.outsoleVariantId))];
  const claims = await tx.productClaim.findMany({ where: { OR: [{ entryId: { in: entryIds } }, { variantId: { in: variantIds } }] }, select: { id: true, entryId: true, variantId: true, attribute: true, value: true, status: true, sourceId: true, sourceUrl: true, observationKey: true }, take: entryIds.length * 201 + 1 });
  for (const e of entries) {
    const scoped = claims.filter(c => c.entryId === e.id || c.variantId === e.outsoleVariantId);
    // Legacy attributed values are protected evidence too (as in D2/D3), without inventing registry review.
    const legacy = legacyObservations(e);
    map.set(e.id, {
      surface: e.variant.surface, identifiers: e.identifiers, variantId: e.outsoleVariantId, version: e.version,
      claims: [...legacy.map(c => ({ id: c.id, attribute: c.attribute, value: c.value as unknown, status: c.status, sourceId: "legacy" })), ...scoped.map(c => ({ id: c.id, attribute: c.attribute, value: c.value, status: c.status, sourceId: c.sourceId }))],
      images: e.productImages.map(i => ({ id: i.id, externalUrl: i.externalUrl, sourceId: i.sourceId, publicEligible: publicAssets([i]).length === 1 })),
      targetClaims: [...legacy.map(c => ({ id: c.id, attribute: c.attribute, value: c.value as unknown, status: c.status, sourceUrl: c.sourceUrl, observationKey: null })), ...scoped.map(c => ({ id: c.id, attribute: c.attribute, value: c.value, status: c.status, sourceUrl: c.sourceUrl, observationKey: c.observationKey }))],
      targetImages: e.productImages.map(i => ({ assetKey: i.assetKey, externalUrl: i.externalUrl, uploadedImageId: i.uploadedImageId, isPrimary: i.isPrimary })),
    });
  }
  return map;
}

type Prepared = { products: Record<string, unknown>[]; offers: IncomingOffer[]; rejected: number; fetched: number; mode: "SNAPSHOT" | "DELTA" };
function prepareRecords(records: unknown[], adapter: SyncAdapter, policy: ReturnType<typeof fieldPolicy>): Prepared {
  const split = splitRecords(records);
  let rejected = split.malformed;
  // Feeds may only reference public HTTPS image URLs, never private uploads; such records are rejected.
  const products = split.products.filter(p => {
    const bad = Array.isArray(p.images) && p.images.some(i => !!i && typeof i === "object" && "uploadedImageId" in i);
    if (bad) rejected++;
    return !bad;
  }).map(p => ({ ...p, images: Array.isArray(p.images) ? p.images.map(i => ({ ...(i as object), isPrimary: false })) : p.images }));
  const offers: IncomingOffer[] = [];
  for (const raw of split.offers) { try { offers.push(normalizeOffer(raw, policy)); } catch { rejected++; } }
  return { products, offers, rejected, fetched: records.length, mode: adapter.mode };
}

async function planProducts(tx: Tx, sourceId: string, source: { id: string; name: string; type: string; version: number; brandId: string | null }, products: Record<string, unknown>[]) {
  const input = { sourceId, format: "JSON" as const, content: JSON.stringify({ version: 1, products }), mapping: {} };
  const limits = importLimits();
  const plan = products.length ? prepareImport(input, source, await readGraph(tx, input, "", limits), limits) : null;
  const recordIds = products.map(p => String(p.recordId ?? "")).filter(Boolean);
  const records = recordIds.length ? await tx.productSourceRecord.findMany({ where: { sourceId, recordId: { in: recordIds } }, select: { recordId: true, sourceUrl: true } }) : [];
  return { plan, recordUrls: new Map(records.map(r => [r.recordId, r.sourceUrl])) };
}

async function offerTargets(tx: Tx, sourceId: string, offers: IncomingOffer[]) {
  const ids = [...new Set(offers.map(o => o.recordId))];
  // Exact identity only: the source's own record mapping. No name, country or variant inference.
  const mapped = ids.length ? await tx.productSourceRecord.findMany({ where: { sourceId, recordId: { in: ids }, entryId: { not: null } }, select: { recordId: true, entry: { select: { id: true, outsoleVariantId: true, published: true } } } }) : [];
  return new Map(mapped.flatMap(m => m.entry ? [[m.recordId, m.entry] as const] : []));
}

async function applyOffers(tx: Tx, o: { sourceId: string; sourceType: string; jobId: string; now: Date; complete: boolean; offers: IncomingOffer[]; policy: ReturnType<typeof fieldPolicy>; config: ReturnType<typeof syncConfig> }) {
  const counts = { offersSeen: o.offers.length, offersUnresolved: 0, offersCreated: 0, priceIncreases: 0, priceDecreases: 0, currencyChanges: 0, availabilityChanges: 0, pricesMissing: 0, removed: 0, refreshed: 0, unchanged: 0, publishedPrices: 0, markedMissing: 0, skippedReplays: 0 };
  if (o.policy.prices === "OFF" && o.policy.availability === "OFF") return counts;
  const targets = await offerTargets(tx, o.sourceId, o.offers);
  // One record per listing key: the newest observation wins within a feed.
  const latest = new Map<string, IncomingOffer>();
  for (const offer of o.offers) { if (!targets.has(offer.recordId)) { counts.offersUnresolved++; continue; } const prev = latest.get(offer.listingKey); if (!prev || prev.observedAt < offer.observedAt) latest.set(offer.listingKey, offer); }
  const keys = [...latest.keys()];
  const existing = new Map<string, Awaited<ReturnType<typeof tx.productOffer.findMany>>[number] & { lastEvidenceAt: Date | null }>();
  for (let at = 0; at < keys.length; at += 1000) {
    const rows = await tx.productOffer.findMany({ where: { sourceId: o.sourceId, listingKey: { in: keys.slice(at, at + 1000) } }, include: { observations: { where: { evidenceId: { not: null } }, orderBy: { observedAt: "desc" }, take: 1, select: { observedAt: true } } } });
    for (const r of rows) existing.set(r.listingKey, { ...r, lastEvidenceAt: r.observations[0]?.observedAt ?? null });
  }
  const creates: Prisma.ProductOfferCreateManyInput[] = [], updates: Prisma.Sql[] = [], observations: Prisma.ProductOfferObservationCreateManyInput[] = [], evidence: Prisma.RecommendationEvidenceCreateManyInput[] = [];
  const cents = (d: Prisma.Decimal | null) => d === null ? null : Math.round(Number(d) * 100);
  for (const [key, incoming] of latest) {
    const target = targets.get(incoming.recordId)!, row = existing.get(key);
    // Evidence refresh only matters where a price may be published at all.
    const publishable = target.published && o.policy.prices === "AUTO";
    const diff = diffOffer(row ? { status: row.status, currency: row.currency, amountCents: cents(row.amount), availability: row.availability, lastObservedAt: row.lastObservedAt, priceMissingSince: row.priceMissingSince, lastEvidenceAt: publishable ? row.lastEvidenceAt : o.now } : null, incoming, o.now, o.config);
    if (diff.action === "SKIP") { counts.skippedReplays++; continue; }
    const offerId = row?.id ?? randomUUID();
    const next = diff.next;
    if (diff.action === "CREATE" && next) {
      counts.offersCreated++;
      creates.push({ id: offerId, sourceId: o.sourceId, listingKey: key, recordId: incoming.recordId, entryId: target.id, variantId: target.outsoleVariantId, countryCode: incoming.countryCode, size: incoming.size, sizeSystem: incoming.sizeSystem, currency: next.currency, amount: next.amountCents === null ? null : formatCents(next.amountCents), availability: next.availability, rawAvailability: incoming.rawAvailability, sourceUrl: incoming.sourceUrl, status: "ACTIVE", firstSeenAt: incoming.observedAt, lastObservedAt: incoming.observedAt, lastChangedAt: incoming.observedAt, priceMissingSince: next.priceMissingSince });
    } else if (row) {
      const n = next ?? { status: row.status as "ACTIVE" | "REMOVED", currency: row.currency, amountCents: cents(row.amount), previousCents: null, previousCurrency: null, availability: row.availability, priceMissingSince: row.priceMissingSince };
      const changed = diff.change !== null && diff.change !== "REFRESH";
      updates.push(Prisma.sql`(${row.id}, ${n.status}, ${n.currency}, ${n.amountCents === null ? null : formatCents(n.amountCents)}::numeric, ${n.previousCents === null ? (row.previousAmount === null ? null : String(row.previousAmount)) : formatCents(n.previousCents)}::numeric, ${n.previousCurrency ?? row.previousCurrency}, ${n.availability}::"OfferAvailability", ${incoming.rawAvailability ?? row.rawAvailability}, ${incoming.sourceUrl}, ${incoming.observedAt}::timestamptz, ${changed ? incoming.observedAt : row.lastChangedAt}::timestamptz, ${n.priceMissingSince}::timestamptz)`);
      if (diff.change === null) counts.unchanged++;
    }
    const change = diff.change;
    if (!change || !next) continue;
    counts.priceIncreases += Number(change === "PRICE_INCREASE"); counts.priceDecreases += Number(change === "PRICE_DECREASE"); counts.currencyChanges += Number(change === "CURRENCY_CHANGE");
    counts.availabilityChanges += Number(change === "AVAILABILITY" || change === "PRICE_AND_AVAILABILITY"); counts.pricesMissing += Number(change === "PRICE_MISSING"); counts.removed += Number(change === "REMOVED"); counts.refreshed += Number(change === "REFRESH");
    let evidenceId: string | null = null;
    // Only an AUTO price policy publishes, only for published products, and the evidence expires on its own.
    if (target.published && publishesPrice(change, next.amountCents, o.policy)) {
      evidenceId = randomUUID(); counts.publishedPrices++;
      evidence.push({ id: evidenceId, variantId: target.outsoleVariantId, entryId: target.id, sourceId: o.sourceId, countryCode: incoming.countryCode, kind: "PRICE", sourceKind: o.sourceType === "MANUFACTURER" ? "MANUFACTURER" : "RETAILER", sourceUrl: incoming.sourceUrl, observedAt: incoming.observedAt, validUntil: new Date(incoming.observedAt.getTime() + o.config.priceEvidenceHours * 3_600_000), approved: true, payload: { entryId: target.id, size: incoming.size, sizeSystem: incoming.sizeSystem, amount: formatCents(next.amountCents!), currency: next.currency } });
    }
    observations.push({ offerId, jobId: o.jobId, change, amount: next.amountCents === null ? null : formatCents(next.amountCents), currency: next.amountCents === null ? null : next.currency, availability: next.availability, rawAvailability: incoming.rawAvailability, sourceUrl: incoming.sourceUrl, observedAt: incoming.observedAt, evidenceId });
  }
  const chunk = async <T>(rows: T[], save: (part: T[]) => Promise<unknown>) => { for (let at = 0; at < rows.length; at += 250) await save(rows.slice(at, at + 250)); };
  await chunk(creates, part => tx.productOffer.createMany({ data: part }));
  await chunk(updates, part => tx.$executeRaw(Prisma.sql`
    UPDATE "ProductOffer" AS o SET status=v.status, currency=v.currency, amount=v.amount, "previousAmount"=v.previous_amount, "previousCurrency"=v.previous_currency, availability=v.availability,
      "rawAvailability"=v.raw, "sourceUrl"=v.url, "lastObservedAt"=v.observed, "lastChangedAt"=v.changed, "priceMissingSince"=v.missing_price, "missingSince"=NULL, "updatedAt"=now()
    FROM (VALUES ${Prisma.join(part)}) AS v(id, status, currency, amount, previous_amount, previous_currency, availability, raw, url, observed, changed, missing_price) WHERE o.id=v.id`));
  await chunk(evidence, part => tx.recommendationEvidence.createMany({ data: part }));
  // Unique (offer, observedAt) makes a replayed feed a no-op.
  await chunk(observations, part => tx.productOfferObservation.createMany({ data: part, skipDuplicates: true }));
  // Absence proves nothing in a partial feed; in a complete snapshot it is only noted, never treated as sold out.
  if (o.complete && keys.length) counts.markedMissing = (await tx.productOffer.updateMany({ where: { sourceId: o.sourceId, status: "ACTIVE", missingSince: null, listingKey: { notIn: keys } }, data: { missingSince: o.now } })).count;
  return counts;
}

async function persistChanges(tx: Tx, jobId: string, sourceId: string, changes: ReturnType<typeof detectChanges>["changes"], claimIds: Map<string, string>) {
  for (let at = 0; at < changes.length; at += 250) {
    const part = changes.slice(at, at + 250);
    // Re-detecting an open or dismissed change only refreshes lastSeen; it never creates a duplicate pending item.
    await tx.$executeRaw(Prisma.sql`INSERT INTO "SourceSyncChange" (id,"jobId","lastSeenJobId","sourceId","entryId","recordId",outcome,kind,severity,attribute,"previousValue","proposedValue","claimId",disposition,"changeKey") VALUES
      ${Prisma.join(part.map(c => Prisma.sql`(${randomUUID()},${jobId},${jobId},${sourceId},${c.entryId},${c.recordId},${c.outcome},${c.kind},${c.severity},${c.attribute},${JSON.stringify(c.previousValue)}::jsonb,${JSON.stringify(c.proposedValue)}::jsonb,${claimIds.get(`${c.entryId}:${c.attribute}`) ?? null},${c.disposition},${c.changeKey})`))}
      ON CONFLICT ("changeKey") DO UPDATE SET "lastSeenJobId"=excluded."lastSeenJobId","lastSeenAt"=now()`);
  }
}

/** Runs one source end to end. Safe to call from any entry point; locking and eligibility are enforced here. */
export async function runSourceSync(options: RunOptions): Promise<RunResult> {
  localImportsOnly();
  const env = options.env ?? process.env, config = syncConfig(env), now = options.now ?? new Date(), notifier = options.notifier ?? logNotifier;
  const o = { ...options, owner: options.owner ?? `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`, mode: options.mode ?? "RUN" };
  const claimed = await claim(o, now, config, env);
  if ("skip" in claimed) { log("sync_job_skipped", { entryPoint: o.entryPoint, sourceId: o.sourceId, reason: claimed.skip }); return { status: "SKIPPED", reason: claimed.skip!, ...("jobId" in claimed && claimed.jobId ? { jobId: claimed.jobId } : {}) }; }
  const { job, source } = claimed;
  const started = performance.now(), db = getDb(), policy = fieldPolicy(source.fieldPolicy), timings: Record<string, number> = {};
  log("sync_job_started", { requestId: job.id, entryPoint: o.entryPoint, trigger: o.trigger, mode: o.mode, sourceId: source.id, adapter: source.adapterKey });
  const controller = new AbortController();
  const relay = () => controller.abort(); o.signal?.addEventListener("abort", relay);
  // Heartbeat extends the lease; losing it (another worker recovered the job) aborts this run.
  const heartbeat = setInterval(() => {
    db.sourceSyncJob.updateMany({ where: { id: job.id, status: "RUNNING", leaseOwner: o.owner }, data: { heartbeatAt: new Date(), leaseExpiresAt: new Date(Date.now() + config.leaseMinutes * 60_000) } })
      .then(r => { if (!r.count) controller.abort(); }).catch(() => {});
  }, Math.max(1000, config.leaseMinutes * 20_000));
  let adapter: SyncAdapter | undefined;
  try {
    adapter = await adapterFor(source.adapterKey!, env);
    const t0 = performance.now();
    const records = await collectFeed(adapter, { authorizationStatus: source.authorizationStatus, permissionDocumented: !!source.permissionNotes && !!source.permissionUrl, ...adapter.settings }, adapter.credentials, undefined, controller.signal);
    timings.fetchMs = Math.round(performance.now() - t0);
    const prepared = prepareRecords(records, adapter, policy);
    const maxRejectRaw = Number(env.SYNC_MAX_REJECT_RATE ?? 0.5), maxReject = Number.isFinite(maxRejectRaw) && maxRejectRaw >= 0 && maxRejectRaw <= 1 ? maxRejectRaw : 0.5;
    if (controller.signal.aborted) throw new SyncError("CANCELLED");
    const sourceInfo = { id: source.id, name: source.name, type: source.type, version: source.version, brandId: source.brandId };
    const complete = prepared.mode === "SNAPSHOT";

    if (o.mode === "PREVIEW") {
      // Read-only: fetch, plan and compare without changing catalogue, evidence or offers.
      const preview = await db.$transaction(async tx => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        const { plan, recordUrls } = await planProducts(tx, source.id, sourceInfo, prepared.products);
        const exact = plan ? plan.rows.filter(r => outcomeOf(r) === "EXISTING_PRODUCT").map(r => r.entryId!) : [];
        const detected = plan ? detectChanges({ sourceId: source.id, complete, plan, existing: await existingState(tx, exact), recordUrls, config }) : null;
        const targets = await offerTargets(tx, source.id, prepared.offers);
        return { outcomes: detected?.outcomes ?? {}, changes: (detected?.changes ?? []).slice(0, 200), changeCount: detected?.changes.length ?? 0, offers: prepared.offers.length, offersResolvable: prepared.offers.filter(x => targets.has(x.recordId)).length, rejected: prepared.rejected, invalidRows: plan?.rows.filter(r => r.action === "REJECT").length ?? 0 };
      }, { isolationLevel: "RepeatableRead", timeout: 60_000 });
      const summary = { fetched: prepared.fetched, rejected: prepared.rejected + preview.invalidRows, changes: preview.changeCount, outcomes: preview.outcomes, offers: preview.offers, durationMs: Math.round(performance.now() - started), ...timings };
      await finish(job.id, o.owner, "SUCCEEDED", summary, null);
      log("sync_job_finished", { requestId: job.id, entryPoint: o.entryPoint, mode: "PREVIEW", sourceId: source.id, ...summary });
      return { status: "SUCCEEDED", jobId: job.id, mode: "PREVIEW", summary, preview };
    }

    const t1 = performance.now();
    const outcome = await db.$transaction(async tx => {
      const [lock] = await tx.$queryRaw<{ acquired: boolean }[]>`SELECT pg_try_advisory_xact_lock(${DATA_WRITER_LOCK}) AS acquired`;
      if (!lock.acquired) throw new SyncError("BUSY");
      const [owned] = await tx.$queryRaw<{ ok: boolean }[]>`SELECT (status='RUNNING' AND "leaseOwner"=${o.owner}) AS ok FROM "SourceSyncJob" WHERE id=${job.id} FOR UPDATE`;
      if (!owned?.ok) throw new SyncError("WORKER_LOST");
      // Permission may have been revoked while fetching: re-check before writing anything.
      await tx.$queryRaw`SELECT id FROM "ProductSource" WHERE id=${source.id} FOR SHARE`;
      const fresh = await tx.productSource.findUniqueOrThrow({ where: { id: source.id } });
      if (!eligibility({ ...fresh, lastSyncAttemptAt: null, nextSyncAt: null, backoffUntil: null }, "MANUAL", now, config, key => isRegistered(key, env)).eligible) throw new SyncError("NOT_PERMITTED");
      const { plan, recordUrls } = await planProducts(tx, source.id, sourceInfo, prepared.products);
      // A mostly invalid feed is refused as a whole (envelope and row-level rejects), before anything is written.
      const rowRejects = plan ? plan.rows.filter(r => r.action === "REJECT").length : 0;
      if (prepared.fetched > 0 && (prepared.rejected + rowRejects) / prepared.fetched > maxReject) throw new SyncError("INVALID_FEED");
      const exactIds = plan ? [...new Set(plan.rows.filter(r => outcomeOf(r) === "EXISTING_PRODUCT").map(r => r.entryId!))] : [];
      const state = await existingState(tx, exactIds);
      const detected = plan ? detectChanges({ sourceId: source.id, complete, plan, existing: state, recordUrls, config }) : { changes: [], enrichmentRows: [], outcomes: {}, unchanged: [] };
      const td = performance.now();
      const batch = await tx.productImportBatch.create({ data: { sourceId: source.id, purpose: "SYNC", format: "JSON", checksum: createHash("sha256").update(stableJson(records)).digest("hex"), idempotencyKey: `sync-${job.id}`, sourceSnapshot: { type: source.type, version: source.version, authorizationStatus: fresh.authorizationStatus, permissionUrl: fresh.permissionUrl, authorizationCheckedAt: fresh.authorizationCheckedAt?.toISOString() ?? null, adapter: source.adapterKey } } });
      if (plan) {
        // Existing exact products are represented by evidence rows below; only other outcomes keep D2 rows.
        const kept: PreparedImport = { ...plan, rows: plan.rows.filter(r => outcomeOf(r) !== "EXISTING_PRODUCT") };
        await persistPlan(tx, kept, batch.id, source.id, source.type);
      }
      const claimIds = new Map<string, string>();
      if (detected.enrichmentRows.length) {
        const eplan = prepareEnrichment(detected.enrichmentRows.map(({ row, ...r }) => { void row; return { ...r, sourceRevision: null }; }), { id: source.id, version: source.version },
          detected.enrichmentRows.map(r => { const s = state.get(r.entryId)!; return { id: r.entryId, outsoleVariantId: s.variantId, version: s.version, surface: s.surface, claims: s.targetClaims, productImages: s.targetImages }; }).filter((t, i, all) => all.findIndex(x => x.id === t.id) === i));
        eplan.rows.forEach((row, i) => { row.row = detected.enrichmentRows[i].row; });
        await persistEnrichment(tx, eplan, batch.id);
        const keys = eplan.rows.flatMap(r => r.claims.filter(c => !c.duplicate).map(c => c.observationKey));
        const created = keys.length ? await tx.productClaim.findMany({ where: { observationKey: { in: keys } }, select: { id: true, entryId: true, attribute: true } }) : [];
        for (const c of created) claimIds.set(`${c.entryId}:${c.attribute}`, c.id);
      }
      await persistChanges(tx, job.id, source.id, detected.changes, claimIds);
      timings.detectAndPersistMs = Math.round(performance.now() - td);
      const offers = await applyOffers(tx, { sourceId: source.id, sourceType: source.type, jobId: job.id, now, complete, offers: prepared.offers, policy, config });
      const invalidRows = rowRejects;
      const bySeverity = detected.changes.reduce<Record<string, number>>((n, c) => ({ ...n, [c.severity]: (n[c.severity] ?? 0) + 1 }), {});
      const summary = { fetched: prepared.fetched, products: prepared.products.length, rejected: prepared.rejected + invalidRows, outcomes: detected.outcomes, newProducts: detected.outcomes.NEW_PRODUCT ?? 0, changes: detected.changes.length, changesBySeverity: bySeverity, pendingReview: detected.changes.filter(c => c.disposition === "PENDING_REVIEW").length, unchangedProducts: detected.unchanged.length, ...offers, mode: prepared.mode };
      await tx.productImportBatch.update({ where: { id: batch.id }, data: { status: "SUCCEEDED", completedAt: new Date(), summary } });
      await tx.moderationAction.create({ data: { actorId: o.actorId ?? null, targetKey: `SOURCE:${source.id}`, action: "SOURCE_SYNC", note: `Sync ${job.id} (${o.entryPoint}): ${summary.newProducts} new drafts, ${summary.changes} changes (${summary.pendingReview} need review), ${offers.publishedPrices} published prices. Nothing auto-published.`.slice(0, 1000) } });
      return { summary, batchId: batch.id, criticalChanges: (bySeverity.CRITICAL ?? 0) };
    }, { isolationLevel: "Serializable", timeout: 180_000, maxWait: 5000 });
    timings.writeMs = Math.round(performance.now() - t1);
    const summary = { ...outcome.summary, durationMs: Math.round(performance.now() - started), processHighWaterRssKb: process.resourceUsage().maxRSS, ...timings };
    const previousSnapshot = await db.sourceSyncJob.findFirst({ where: { sourceId: source.id, status: "SUCCEEDED", mode: "RUN", id: { not: job.id } }, orderBy: { startedAt: "desc" }, select: { summary: true } });
    const previous = previousSnapshot?.summary as { mode?: string; fetched?: number } | undefined;
    const previousFetched = previous?.mode === "SNAPSHOT" && typeof previous.fetched === "number" ? previous.fetched : null;
    await finish(job.id, o.owner, "SUCCEEDED", summary, null, outcome.batchId);
    await db.productSource.update({ where: { id: source.id }, data: { lastSyncSuccessAt: now, nextSyncAt: source.syncIntervalMinutes ? new Date(now.getTime() + source.syncIntervalMinutes * 60_000) : null, syncFailureCount: 0, backoffUntil: null, lastSyncErrorCategory: null } });
    log("sync_job_finished", { requestId: job.id, entryPoint: o.entryPoint, mode: "RUN", sourceId: source.id, fetched: summary.fetched, changes: summary.changes, pendingReview: summary.pendingReview, rejected: summary.rejected, durationMs: summary.durationMs });
    await afterSuccess(source.id, job.id, { mode: prepared.mode, fetched: prepared.fetched, rejected: summary.rejected, products: prepared.products.length, criticalChanges: outcome.criticalChanges, previousSnapshotFetched: previousFetched }, notifier);
    return { status: "SUCCEEDED", jobId: job.id, mode: "RUN", summary };
  } catch (error) {
    const { category, retryAfterMs } = controller.signal.aborted && !(error instanceof SyncError && error.category === "WORKER_LOST") ? { category: "CANCELLED" as const, retryAfterMs: 0 } : classify(error);
    const status = category === "CANCELLED" ? "CANCELLED" as const : "FAILED" as const;
    log("sync_job_failed", { requestId: job.id, entryPoint: o.entryPoint, sourceId: source.id, category, detail: redact(error instanceof Error ? error.message : "unknown", adapter?.secrets ?? []) });
    try {
      await finish(job.id, o.owner, status, { durationMs: Math.round(performance.now() - started), ...timings }, category);
      if (category !== "CANCELLED") {
        // BUSY is a local scheduling collision, not a provider failure: short retry, not counted.
        const failures = category === "BUSY" ? source.syncFailureCount : source.syncFailureCount + 1;
        const delay = category === "BUSY" ? 120_000 : backoffMs(category, failures, retryAfterMs, config, options.random);
        const until = new Date(now.getTime() + delay);
        await db.productSource.update({ where: { id: source.id }, data: { syncFailureCount: failures, lastSyncErrorCategory: category, backoffUntil: until, nextSyncAt: until } });
        const alert = category === "BUSY" ? null : alertAfterFailure(source.id, failures, category, config);
        if (alert) await raiseAlert(db, alert, source.id, job.id, notifier);
      }
    } catch {
      // The database itself may be down. The lease then expires and the next run recovers the job.
      log("sync_job_finalize_failed", { requestId: job.id, entryPoint: o.entryPoint, sourceId: source.id });
    }
    return { status, jobId: job.id, mode: o.mode, summary: { durationMs: Math.round(performance.now() - started) }, errorCategory: category };
  } finally {
    clearInterval(heartbeat);
    o.signal?.removeEventListener("abort", relay);
  }
}

async function finish(jobId: string, owner: string, status: "SUCCEEDED" | "FAILED" | "CANCELLED", summary: Record<string, unknown>, category: ErrorCategory | null, batchId?: string) {
  await getDb().sourceSyncJob.updateMany({ where: { id: jobId, status: "RUNNING", leaseOwner: owner }, data: { status, completedAt: new Date(), durationMs: Number(summary.durationMs ?? 0), summary: summary as Prisma.InputJsonObject, errorCategory: category, errorDetail: category ? detail[category] : null, batchId: batchId ?? null } });
}
async function afterSuccess(sourceId: string, jobId: string, facts: Parameters<typeof alertsAfterSuccess>[1], notifier: AlertNotifier) {
  try {
    const db = getDb();
    await resolveAlerts(db, sourceId, ["REPEATED_FAILURES", "STALE_FEED", "LONG_RUNNING_JOB", "AUTHORIZATION_EXPIRED"]);
    for (const alert of alertsAfterSuccess(sourceId, facts)) await raiseAlert(db, alert, sourceId, jobId, notifier);
  } catch { log("sync_alert_failed", { requestId: jobId, sourceId }); }
}

/** Runs every due source once. Entry point for cron/EventBridge-style schedulers and the CLI. */
export async function runDueSources(o: { entryPoint: EntryPoint; limit?: number; signal?: AbortSignal; env?: Record<string, string | undefined>; notifier?: AlertNotifier; now?: Date }) {
  localImportsOnly();
  const now = o.now ?? new Date();
  const due = await getDb().productSource.findMany({ where: { syncEnabled: true, status: "ACTIVE", OR: [{ nextSyncAt: null }, { nextSyncAt: { lte: now } }], AND: [{ OR: [{ backoffUntil: null }, { backoffUntil: { lte: now } }] }] }, orderBy: [{ nextSyncAt: "asc" }, { id: "asc" }], take: Math.min(o.limit ?? 20, 100), select: { id: true } });
  const results: (RunResult & { sourceId: string })[] = [];
  for (const { id } of due) {
    if (o.signal?.aborted) break; // safe shutdown: finish the current source, start no new one
    results.push({ sourceId: id, ...(await runSourceSync({ sourceId: id, trigger: "SCHEDULED", entryPoint: o.entryPoint, signal: o.signal, env: o.env, notifier: o.notifier, now: o.now })) });
  }
  return results;
}

/** Periodic maintenance: recover expired leases, raise time-based alerts, enforce retention. */
export async function sweep(o: { env?: Record<string, string | undefined>; notifier?: AlertNotifier; now?: Date } = {}) {
  localImportsOnly();
  const env = o.env ?? process.env, config = syncConfig(env), now = o.now ?? new Date(), db = getDb(), notifier = o.notifier ?? logNotifier;
  const expired = await db.sourceSyncJob.findMany({ where: { status: "RUNNING", leaseExpiresAt: { lt: now } }, select: { id: true, sourceId: true } });
  for (const job of expired) {
    const r = await db.sourceSyncJob.updateMany({ where: { id: job.id, status: "RUNNING", leaseExpiresAt: { lt: now } }, data: { status: "ABANDONED", completedAt: now, errorCategory: "WORKER_LOST", errorDetail: detail.WORKER_LOST } });
    if (r.count) await db.productSource.update({ where: { id: job.sourceId }, data: { syncFailureCount: { increment: 1 }, lastSyncErrorCategory: "WORKER_LOST" } });
  }
  const sources = await db.productSource.findMany({ where: { OR: [{ syncEnabled: true }, { syncJobs: { some: { status: "RUNNING" } } }] }, take: 1000, include: { syncJobs: { where: { status: "RUNNING" }, select: { startedAt: true }, take: 1 } } });
  let alerts = 0;
  for (const s of sources) {
    const auth = eligibility({ ...s, lastSyncAttemptAt: null, nextSyncAt: null, backoffUntil: null }, "MANUAL", now, config, () => true);
    for (const alert of sweepAlerts({ sourceId: s.id, syncEnabled: s.syncEnabled, intervalMinutes: s.syncIntervalMinutes, lastSyncSuccessAt: s.lastSyncSuccessAt, authorizationExpired: ["NOT_AUTHORIZED", "AUTHORIZATION_REVIEW_DUE"].includes(auth.reason), runningSince: s.syncJobs[0]?.startedAt ?? null }, now, config)) { await raiseAlert(db, alert, s.id, null, notifier); alerts++; }
  }
  // Retention: drop raw canonical payloads of old sync batches (outcomes, provenance and history remain).
  const retentionDays = Number(env.SYNC_PAYLOAD_RETENTION_DAYS ?? 30);
  const cutoff = new Date(now.getTime() - (Number.isFinite(retentionDays) && retentionDays >= 1 ? retentionDays : 30) * 86_400_000);
  const pruned = await db.productImportRow.updateMany({ where: { batch: { purpose: "SYNC", startedAt: { lt: cutoff } }, NOT: { data: { equals: Prisma.DbNull } } }, data: { data: Prisma.DbNull } });
  const nonces = await db.schedulerNonce.deleteMany({ where: { receivedAt: { lt: new Date(now.getTime() - 86_400_000) } } });
  log("sync_sweep_finished", { entryPoint: "scheduler", recoveredLeases: expired.length, alerts, prunedPayloads: pruned.count, expiredNonces: nonces.count });
  return { recoveredLeases: expired.length, alerts, prunedPayloads: pruned.count, expiredNonces: nonces.count };
}

