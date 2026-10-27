import { describe, expect, it } from "vitest";
import { alertAfterFailure, alertsAfterSuccess, sweepAlerts } from "./alert-rules";
import { syncConfig } from "./policy";

const config = syncConfig({});
const facts = { mode: "SNAPSHOT" as const, fetched: 100, rejected: 0, products: 100, criticalChanges: 0, previousSnapshotFetched: 100 };
describe("D5 alert rules", () => {
  it("raises nothing for a normal run", () => expect(alertsAfterSuccess("s", facts)).toEqual([]));
  it("flags high rejection, excessive conflicts and a shrinking snapshot", () => {
    expect(alertsAfterSuccess("s", { ...facts, rejected: 30 }).map(a => a.kind)).toEqual(["HIGH_REJECTION_RATE"]);
    expect(alertsAfterSuccess("s", { ...facts, criticalChanges: 25 }).map(a => a.kind)).toEqual(["EXCESSIVE_CONFLICTS"]);
    expect(alertsAfterSuccess("s", { ...facts, fetched: 40 }).map(a => a.kind)).toEqual(["FEED_SIZE_DROP"]);
    expect(alertsAfterSuccess("s", { ...facts, mode: "DELTA", fetched: 40 })).toEqual([]);
  });
  it("pages on authorization failures and repeated failures, with a runbook and a stable dedupe key", () => {
    const auth = alertAfterFailure("s", 1, "AUTHORIZATION", config)!;
    expect(auth).toMatchObject({ kind: "AUTHORIZATION_EXPIRED", severity: "PAGE", dedupeKey: "AUTHORIZATION_EXPIRED:s" });
    expect(auth.message).toContain("docs/runbooks/source-sync.md#authorization-expired");
    expect(alertAfterFailure("s", 1, "TIMEOUT", config)).toBeNull();
    expect(alertAfterFailure("s", 3, "TIMEOUT", config)?.kind).toBe("REPEATED_FAILURES");
  });
  it("detects long-running jobs, stale feeds and lapsed authorization on sweep", () => {
    const now = new Date("2026-10-27T12:00:00Z");
    const kinds = sweepAlerts({ sourceId: "s", syncEnabled: true, intervalMinutes: 60, lastSyncSuccessAt: new Date("2026-10-27T06:00:00Z"), authorizationExpired: true, runningSince: new Date("2026-10-27T11:00:00Z") }, now, config).map(a => a.kind);
    expect(kinds).toEqual(["AUTHORIZATION_EXPIRED", "LONG_RUNNING_JOB", "STALE_FEED"]);
    expect(sweepAlerts({ sourceId: "s", syncEnabled: false, intervalMinutes: 60, lastSyncSuccessAt: null, authorizationExpired: true, runningSince: null }, now, config)).toEqual([]);
  });
});
