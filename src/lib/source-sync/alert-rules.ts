// D5 operational alert rules. Pure. Two severities only: PAGE (act now) and TICKET (act this week).
import type { SyncConfig } from "./policy";

export type AlertKind = "REPEATED_FAILURES" | "AUTHORIZATION_EXPIRED" | "LONG_RUNNING_JOB" | "EXCESSIVE_CONFLICTS" | "FEED_SIZE_DROP" | "STALE_FEED" | "HIGH_REJECTION_RATE";
export type AlertDraft = { kind: AlertKind; severity: "PAGE" | "TICKET"; message: string; dedupeKey: string };
const runbook = (kind: AlertKind) => `Runbook: docs/runbooks/source-sync.md#${kind.toLowerCase().replace(/_/g, "-")}`;
const draft = (sourceId: string, kind: AlertKind, severity: "PAGE" | "TICKET", text: string): AlertDraft => ({ kind, severity, message: `${text} ${runbook(kind)}`.slice(0, 500), dedupeKey: `${kind}:${sourceId}` });

export type JobFacts = { mode: "SNAPSHOT" | "DELTA"; fetched: number; rejected: number; products: number; criticalChanges: number; previousSnapshotFetched: number | null };
/** Conditions evaluated after a successful run. */
export function alertsAfterSuccess(sourceId: string, f: JobFacts): AlertDraft[] {
  const out: AlertDraft[] = [];
  if (f.fetched >= 10 && f.rejected / f.fetched > 0.2) out.push(draft(sourceId, "HIGH_REJECTION_RATE", "TICKET", `${f.rejected} of ${f.fetched} records were rejected by validation.`));
  if (f.criticalChanges > Math.max(10, f.products * 0.1)) out.push(draft(sourceId, "EXCESSIVE_CONFLICTS", "TICKET", `${f.criticalChanges} critical identity/outsole/SKU changes need review.`));
  // A complete snapshot that shrinks sharply usually means a broken provider export, not mass discontinuation.
  if (f.mode === "SNAPSHOT" && f.previousSnapshotFetched !== null && f.previousSnapshotFetched >= 20 && f.fetched < f.previousSnapshotFetched * 0.5)
    out.push(draft(sourceId, "FEED_SIZE_DROP", "TICKET", `Snapshot shrank from ${f.previousSnapshotFetched} to ${f.fetched} records. Missing listings were not marked unavailable.`));
  return out;
}
export function alertAfterFailure(sourceId: string, failures: number, category: string, config: SyncConfig): AlertDraft | null {
  if (category === "AUTHORIZATION" || category === "NOT_PERMITTED") return draft(sourceId, "AUTHORIZATION_EXPIRED", "PAGE", "The provider rejected the configured credentials or permission. Sync is backed off until an administrator acts.");
  if (failures >= config.failingAfter) return draft(sourceId, "REPEATED_FAILURES", "PAGE", `${failures} consecutive synchronization failures (last: ${category}).`);
  return null;
}
export type SweepFacts = { sourceId: string; syncEnabled: boolean; intervalMinutes: number | null; lastSyncSuccessAt: Date | null; authorizationExpired: boolean; runningSince: Date | null };
/** Conditions evaluated periodically, independent of a job finishing. */
export function sweepAlerts(f: SweepFacts, now: Date, config: SyncConfig): AlertDraft[] {
  const out: AlertDraft[] = [];
  if (f.syncEnabled && f.authorizationExpired) out.push(draft(f.sourceId, "AUTHORIZATION_EXPIRED", "PAGE", "Source authorization is missing or overdue for periodic review; scheduled sync is paused."));
  if (f.runningSince && now.getTime() - f.runningSince.getTime() > config.longRunningMinutes * 60_000) out.push(draft(f.sourceId, "LONG_RUNNING_JOB", "TICKET", `A sync job has been running since ${f.runningSince.toISOString()}.`));
  if (f.syncEnabled && f.intervalMinutes && f.lastSyncSuccessAt && now.getTime() - f.lastSyncSuccessAt.getTime() > f.intervalMinutes * 60_000 * config.staleFeedMultiplier)
    out.push(draft(f.sourceId, "STALE_FEED", "TICKET", `No successful sync since ${f.lastSyncSuccessAt.toISOString()}; prices and stock from this source are stale.`));
  return out;
}
