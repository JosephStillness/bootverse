import { describe, expect, it } from "vitest";
import { backoffMs, classifyChange, eligibility, isPermanent, sourceHealth, syncConfig, fieldPolicy, type SourceState } from "./policy";

const now = new Date("2026-10-27T00:00:00Z");
const source = (over: Partial<SourceState> = {}): SourceState => ({
  status: "ACTIVE", authorizationStatus: "GRANTED", permissionNotes: "Synthetic written permission", permissionUrl: "https://example.test/licence",
  authorizationCheckedAt: new Date("2026-10-01T00:00:00Z"), syncEnabled: true, adapterKey: "fixture:synthetic", syncIntervalMinutes: 1440, minIntervalMinutes: 60,
  nextSyncAt: new Date("2026-10-26T23:00:00Z"), backoffUntil: null, lastSyncAttemptAt: new Date("2026-10-26T00:00:00Z"), lastSyncSuccessAt: new Date("2026-10-26T00:00:00Z"), syncFailureCount: 0, lastSyncErrorCategory: null, ...over,
});
const config = syncConfig({});
const registered = (key: string) => key === "fixture:synthetic";

describe("D5 scheduling eligibility", () => {
  it("runs a due, authorized, enabled source", () => expect(eligibility(source(), "SCHEDULED", now, config, registered)).toEqual({ eligible: true, reason: "DUE" }));
  it("skips a source that is not yet due", () => expect(eligibility(source({ nextSyncAt: new Date("2026-10-27T06:00:00Z") }), "SCHEDULED", now, config, registered).reason).toBe("NOT_DUE"));
  it("skips disabled sources on schedule but allows an authorized manual run", () => {
    expect(eligibility(source({ syncEnabled: false }), "SCHEDULED", now, config, registered).reason).toBe("DISABLED");
    expect(eligibility(source({ syncEnabled: false }), "MANUAL", now, config, registered).eligible).toBe(true);
  });
  it.each([
    ["UNKNOWN", "NOT_AUTHORIZED"], ["REQUESTED", "NOT_AUTHORIZED"], ["DENIED", "NOT_AUTHORIZED"],
  ])("refuses %s authorization even for manual runs", (authorizationStatus, reason) => {
    expect(eligibility(source({ authorizationStatus }), "MANUAL", now, config, registered).reason).toBe(reason);
  });
  it("requires documented permission and a periodic authorization review", () => {
    expect(eligibility(source({ permissionUrl: null }), "SCHEDULED", now, config, registered).reason).toBe("NOT_AUTHORIZED");
    expect(eligibility(source({ authorizationCheckedAt: new Date("2025-01-01T00:00:00Z") }), "SCHEDULED", now, config, registered).reason).toBe("AUTHORIZATION_REVIEW_DUE");
  });
  it("respects backoff and the provider minimum interval for manual runs too", () => {
    expect(eligibility(source({ backoffUntil: new Date("2026-10-27T01:00:00Z") }), "MANUAL", now, config, registered).reason).toBe("BACKOFF");
    expect(eligibility(source({ lastSyncAttemptAt: new Date("2026-10-26T23:30:00Z") }), "MANUAL", now, config, registered).reason).toBe("MIN_INTERVAL");
  });
  it("refuses archived sources and unregistered adapters", () => {
    expect(eligibility(source({ status: "ARCHIVED" }), "MANUAL", now, config, registered).reason).toBe("SOURCE_ARCHIVED");
    expect(eligibility(source({ adapterKey: "http:unknown" }), "MANUAL", now, config, registered).reason).toBe("NO_ADAPTER");
  });
});

describe("D5 retry and backoff", () => {
  it("grows exponentially with bounded jitter and a cap", () => {
    const fixed = () => 0.5;
    expect(backoffMs("TIMEOUT", 1, 0, config, fixed)).toBe(5 * 60_000);
    expect(backoffMs("TIMEOUT", 3, 0, config, fixed)).toBe(20 * 60_000);
    expect(backoffMs("TIMEOUT", 30, 0, config, fixed)).toBe(24 * 3600_000);
    const low = backoffMs("TIMEOUT", 2, 0, config, () => 0), high = backoffMs("TIMEOUT", 2, 0, config, () => 1);
    expect(low).toBeGreaterThanOrEqual(8 * 60_000); expect(high).toBeLessThanOrEqual(12 * 60_000);
  });
  it("honours a provider Retry-After longer than the computed delay", () => expect(backoffMs("RATE_LIMITED", 1, 7_200_000, config, () => 0.5)).toBe(7_200_000));
  it("does not retry permanent failures quickly", () => {
    expect(isPermanent("AUTHORIZATION")).toBe(true); expect(isPermanent("TIMEOUT")).toBe(false);
    expect(backoffMs("AUTHORIZATION", 1, 0, config, () => 0.5)).toBe(24 * 3600_000);
  });
});

describe("D5 source health", () => {
  it("derives every state from real records", () => {
    expect(sourceHealth(source({ lastSyncAttemptAt: null, lastSyncSuccessAt: null }), 0, now, config)).toBe("NEVER_SYNCHRONIZED");
    expect(sourceHealth(source({ syncEnabled: false }), 0, now, config)).toBe("DISABLED");
    expect(sourceHealth(source(), 0, now, config)).toBe("HEALTHY");
    expect(sourceHealth(source({ syncFailureCount: 1, lastSyncErrorCategory: "TIMEOUT" }), 0, now, config)).toBe("DEGRADED");
    expect(sourceHealth(source(), 1, now, config)).toBe("DEGRADED");
    expect(sourceHealth(source({ lastSyncSuccessAt: new Date("2026-10-20T00:00:00Z") }), 0, now, config)).toBe("DEGRADED");
    expect(sourceHealth(source({ syncFailureCount: 3, lastSyncErrorCategory: "TIMEOUT" }), 0, now, config)).toBe("FAILING");
    expect(sourceHealth(source({ syncFailureCount: 1, lastSyncErrorCategory: "AUTHORIZATION" }), 0, now, config)).toBe("FAILING");
  });
});

describe("D5 change classification policy", () => {
  it("routes identity, outsole, SKU and safety changes to critical review", () => {
    for (const kind of ["IDENTITY_CONFLICT", "OUTSOLE_CHANGE", "SKU_CHANGE", "SAFETY_SPEC_CHANGE"] as const) expect(classifyChange(kind, config)).toEqual({ severity: "CRITICAL", disposition: "PENDING_REVIEW" });
  });
  it("routes material public-data changes to review and records routine ones", () => {
    expect(classifyChange("SPEC_CONTRADICTION", config).disposition).toBe("PENDING_REVIEW");
    expect(classifyChange("IMAGE_ADDED", config).severity).toBe("MATERIAL");
    expect(classifyChange("SPEC_CORROBORATION", config)).toEqual({ severity: "ROUTINE", disposition: "RECORDED" });
  });
  it("lets configuration raise but never lower review requirements", () => {
    const strict = syncConfig({ SYNC_SEVERITY_OVERRIDES: JSON.stringify({ SPEC_CORROBORATION: "MATERIAL", SKU_CHANGE: "ROUTINE" }) });
    expect(classifyChange("SPEC_CORROBORATION", strict).severity).toBe("MATERIAL");
    expect(classifyChange("SKU_CHANGE", strict).severity).toBe("CRITICAL");
  });
  it("defaults retail field updates to record-only unless the source policy allows automation", () => {
    expect(fieldPolicy({})).toMatchObject({ prices: "RECORD", availability: "RECORD" });
    expect(fieldPolicy({ prices: "AUTO", availability: "OFF", availabilityLabels: { "Ships Soon": "PREORDER" } })).toMatchObject({ prices: "AUTO", availability: "OFF", availabilityLabels: { "ships soon": "PREORDER" } });
    expect(fieldPolicy({ prices: "ALWAYS" }).prices).toBe("RECORD");
  });
  it("rejects invalid numeric configuration instead of silently using it", () => {
    expect(() => syncConfig({ SYNC_PRICE_FRESH_HOURS: "0" })).toThrow();
    expect(syncConfig({ SYNC_PRICE_FRESH_HOURS: "6" }).priceFreshHours).toBe(6);
  });
});
