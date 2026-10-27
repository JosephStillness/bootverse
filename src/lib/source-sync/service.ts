import "server-only";
import { z } from "zod";
import type { Principal } from "@/lib/accounts/authorization";
import { CommunityError } from "@/lib/community/service";
import { adminTx, audit } from "@/lib/product-data/service";
import { dataId } from "@/lib/product-data/validation";
import { isRegistered, listAdapters } from "./adapters";
import { eligibility, fieldPolicy, sourceHealth, syncConfig, type SourceState } from "./policy";
import { runSourceSync } from "./runner";

const config = () => syncConfig(process.env);
const offerFreshness = (lastObservedAt: Date, now: Date, hours: number) => now.getTime() - lastObservedAt.getTime() > hours * 3_600_000 ? "STALE" : "FRESH";
const sourceSelect = { id: true, name: true, type: true, status: true, authorizationStatus: true, permissionNotes: true, permissionUrl: true, authorizationCheckedAt: true, usageRestrictions: true, syncEnabled: true, adapterKey: true, syncIntervalMinutes: true, minIntervalMinutes: true, fieldPolicy: true, nextSyncAt: true, backoffUntil: true, lastSyncAttemptAt: true, lastSyncSuccessAt: true, syncFailureCount: true, lastSyncErrorCategory: true, updatedAt: true } as const;

function describeSource(s: SourceState, openAlerts: number, now: Date) {
  const c = config();
  return {
    health: sourceHealth(s, openAlerts, now, c),
    scheduled: eligibility(s, "SCHEDULED", now, c, key => isRegistered(key)).reason,
    manual: eligibility(s, "MANUAL", now, c, key => isRegistered(key)).reason,
    adapterRegistered: !!s.adapterKey && isRegistered(s.adapterKey),
  };
}

export async function listDataSources(actor: Principal | null) {
  return adminTx(actor, async tx => {
    const now = new Date();
    const sources = await tx.productSource.findMany({ where: { status: "ACTIVE" }, orderBy: [{ name: "asc" }, { id: "asc" }], take: 200, select: { ...sourceSelect, _count: { select: { alerts: { where: { status: { not: "RESOLVED" } } }, syncChanges: { where: { disposition: "PENDING_REVIEW" } } } }, syncJobs: { orderBy: { startedAt: "desc" }, take: 1, select: { id: true, status: true, startedAt: true, completedAt: true, errorCategory: true, mode: true } } } });
    return {
      adapters: listAdapters().concat(process.env.SYNC_FIXTURES_ENABLED === "1" ? [{ key: "fixture:<name>", kind: "fixture" as const, mode: "SNAPSHOT" as const, host: null }] : []),
      fixturesEnabled: process.env.SYNC_FIXTURES_ENABLED === "1",
      sources: sources.map(({ permissionNotes, permissionUrl, _count, syncJobs, ...s }) => ({ ...s, permissionDocumented: !!permissionNotes && !!permissionUrl, openAlerts: _count.alerts, pendingChanges: _count.syncChanges, lastJob: syncJobs[0] ?? null, ...describeSource({ ...s, permissionNotes, permissionUrl }, _count.alerts, now) })),
    };
  });
}

const offersQuery = z.object({ offersPage: z.coerce.number().int().min(1).max(1000).default(1) }).strict();
export async function dataSourceDetail(actor: Principal | null, id: string, raw: unknown) {
  const q = offersQuery.parse(raw);
  return adminTx(actor, async tx => {
    const now = new Date(), c = config();
    const source = await tx.productSource.findUnique({ where: { id: dataId.parse(id) }, select: { ...sourceSelect, baseUrl: true, accessMethod: true } });
    if (!source) throw new CommunityError(404, "Source not found.");
    const [jobs, alerts, changes, offerTotal, offers, changeCounts] = await Promise.all([
      tx.sourceSyncJob.findMany({ where: { sourceId: id }, orderBy: { startedAt: "desc" }, take: 20, select: { id: true, trigger: true, entryPoint: true, mode: true, status: true, startedAt: true, completedAt: true, durationMs: true, summary: true, errorCategory: true, errorDetail: true, actor: { select: { name: true, email: true } } } }),
      tx.sourceAlert.findMany({ where: { sourceId: id }, orderBy: [{ status: "asc" }, { lastSeenAt: "desc" }], take: 20 }),
      tx.sourceSyncChange.findMany({ where: { sourceId: id }, orderBy: [{ disposition: "desc" }, { lastSeenAt: "desc" }], take: 50, select: { id: true, kind: true, severity: true, outcome: true, disposition: true, attribute: true, recordId: true, previousValue: true, proposedValue: true, lastSeenAt: true, entry: { select: { id: true, slug: true, status: true } } } }),
      tx.productOffer.count({ where: { sourceId: id } }),
      tx.productOffer.findMany({ where: { sourceId: id }, orderBy: [{ lastObservedAt: "desc" }, { id: "asc" }], take: 50, skip: (q.offersPage - 1) * 50, select: { id: true, listingKey: true, countryCode: true, size: true, sizeSystem: true, currency: true, amount: true, previousAmount: true, previousCurrency: true, availability: true, rawAvailability: true, status: true, lastObservedAt: true, lastChangedAt: true, missingSince: true, priceMissingSince: true, sourceUrl: true, entry: { select: { id: true, slug: true, published: true } } } }),
      tx.sourceSyncChange.groupBy({ by: ["disposition"], where: { sourceId: id }, _count: { _all: true } }),
    ]);
    const openAlerts = alerts.filter(a => a.status !== "RESOLVED").length;
    return {
      source: { ...source, permissionDocumented: !!source.permissionNotes && !!source.permissionUrl, fieldPolicy: fieldPolicy(source.fieldPolicy), ...describeSource(source, openAlerts, now) },
      freshness: { priceFreshHours: c.priceFreshHours, stockFreshHours: c.stockFreshHours },
      jobs: jobs.map(j => ({ ...j, actor: j.actor ? j.actor.name ?? j.actor.email : null })), alerts, changes,
      changeCounts: Object.fromEntries(changeCounts.map(r => [r.disposition, r._count._all])),
      offers: offers.map(o => ({ ...o, amount: o.amount?.toFixed(2) ?? null, previousAmount: o.previousAmount?.toFixed(2) ?? null, priceFreshness: offerFreshness(o.lastObservedAt, now, c.priceFreshHours), stockFreshness: offerFreshness(o.lastObservedAt, now, c.stockFreshHours) })),
      offerTotal, offersPage: q.offersPage, offerPages: Math.max(1, Math.ceil(offerTotal / 50)),
    };
  });
}

const intervals = z.number().int().min(5).max(43200);
const updateSchema = z.object({
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
  syncEnabled: z.boolean(), adapterKey: z.string().regex(/^(fixture|http):[a-z0-9-]{1,60}$/).nullable(),
  syncIntervalMinutes: intervals.nullable(), minIntervalMinutes: intervals,
  fieldPolicy: z.object({ prices: z.enum(["AUTO", "RECORD", "OFF"]), availability: z.enum(["AUTO", "RECORD", "OFF"]), availabilityLabels: z.record(z.string().trim().min(1).max(60), z.enum(["IN_STOCK", "OUT_OF_STOCK", "PREORDER", "DISCONTINUED", "UNKNOWN"])).default({}).refine(v => Object.keys(v).length <= 50) }).strict(),
  reason: z.string().trim().min(10).max(1000),
}).strict().refine(v => !v.syncIntervalMinutes || v.syncIntervalMinutes >= v.minIntervalMinutes, "The schedule cannot be more frequent than the provider minimum interval.");
/** Sync configuration only. Authorization itself is changed through the D1 source registry, not here. */
export async function updateDataSource(actor: Principal | null, id: string, raw: unknown) {
  const input = updateSchema.parse(raw);
  return adminTx(actor, async (tx, user) => {
    await tx.$queryRaw`SELECT id FROM "ProductSource" WHERE id=${dataId.parse(id)} FOR UPDATE`;
    const source = await tx.productSource.findUnique({ where: { id }, select: sourceSelect });
    if (!source) throw new CommunityError(404, "Source not found.");
    if (source.updatedAt.toISOString() !== new Date(input.expectedUpdatedAt).toISOString()) throw new CommunityError(409, "This source changed. Reload before saving.");
    if (input.adapterKey && !isRegistered(input.adapterKey)) throw new CommunityError(400, "Choose an adapter configured on this server.");
    if (input.syncEnabled) {
      if (!input.adapterKey || !input.syncIntervalMinutes) throw new CommunityError(400, "Scheduled sync needs an adapter and an interval.");
      const verdict = eligibility({ ...source, ...input, syncEnabled: true, lastSyncAttemptAt: null, backoffUntil: null, nextSyncAt: null }, "MANUAL", new Date(), config(), key => isRegistered(key));
      if (!verdict.eligible) throw new CommunityError(400, verdict.reason === "AUTHORIZATION_REVIEW_DUE" ? "Source authorization is overdue for review. Re-check permission in the source registry first." : "Document that automated access is permitted (GRANTED or NOT_REQUIRED, with notes and a reference) before enabling sync.");
    }
    const updated = await tx.productSource.update({ where: { id }, data: { syncEnabled: input.syncEnabled, adapterKey: input.adapterKey, syncIntervalMinutes: input.syncIntervalMinutes, minIntervalMinutes: input.minIntervalMinutes, fieldPolicy: input.fieldPolicy, ...(input.syncEnabled && !source.syncEnabled ? { nextSyncAt: new Date() } : {}) }, select: sourceSelect });
    await audit(tx, user, `SOURCE:${id}`, "SOURCE_SYNC_CONFIG", `${input.syncEnabled ? "Enabled" : "Disabled"} sync (${input.adapterKey ?? "no adapter"}, every ${input.syncIntervalMinutes ?? "-"} min, prices ${input.fieldPolicy.prices}, stock ${input.fieldPolicy.availability}): ${input.reason}`.slice(0, 1000));
    return updated;
  });
}

const triggerSchema = z.object({ mode: z.enum(["RUN", "PREVIEW"]), requestId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/), confirmed: z.literal(true) }).strict();
/** Manual trigger: same eligibility, rate-limit, backoff and locking rules as the scheduler. */
export async function triggerDataSource(actor: Principal | null, id: string, raw: unknown) {
  const input = triggerSchema.parse(raw);
  const user = await adminTx(actor, async (_tx, u) => u);
  return runSourceSync({ sourceId: dataId.parse(id), trigger: "MANUAL", entryPoint: "admin", mode: input.mode, actorId: user.id, requestId: input.requestId });
}

const alertSchema = z.object({ action: z.enum(["ACKNOWLEDGE", "RESOLVE"]) }).strict();
export async function updateAlert(actor: Principal | null, id: string, raw: unknown) {
  const input = alertSchema.parse(raw);
  return adminTx(actor, async (tx, user) => {
    const alert = await tx.sourceAlert.findUnique({ where: { id: dataId.parse(id) } });
    if (!alert) throw new CommunityError(404, "Alert not found.");
    if (alert.status === "RESOLVED") throw new CommunityError(409, "This alert is already resolved.");
    const data = input.action === "ACKNOWLEDGE" ? { status: "ACKNOWLEDGED", acknowledgedById: user.id, acknowledgedAt: new Date() } : { status: "RESOLVED", resolvedAt: new Date(), acknowledgedById: alert.acknowledgedById ?? user.id };
    const row = await tx.sourceAlert.update({ where: { id }, data });
    await audit(tx, user, `ALERT:${id}`, "SOURCE_ALERT", `${input.action} ${alert.kind}`);
    return row;
  });
}

