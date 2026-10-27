// D5 scheduling, retry, health and change-classification rules. Pure: callers pass time and configuration.
import { z } from "zod";

export const errorCategories = ["AUTHORIZATION", "NOT_PERMITTED", "CONFIG", "TIMEOUT", "UNAVAILABLE", "RATE_LIMITED", "INVALID_FEED", "PARTIAL_FEED", "DATABASE", "STORAGE", "BUSY", "WORKER_LOST", "CANCELLED", "INTERNAL"] as const;
export type ErrorCategory = typeof errorCategories[number];
// Retrying these cannot help until an administrator changes permission or configuration.
const permanent: ErrorCategory[] = ["AUTHORIZATION", "NOT_PERMITTED", "CONFIG"];
export const isPermanent = (c: ErrorCategory) => permanent.includes(c);

export type Trigger = "SCHEDULED" | "MANUAL";
export type SourceState = {
  status: string; authorizationStatus: string; permissionNotes: string | null; permissionUrl: string | null; authorizationCheckedAt: Date | null;
  syncEnabled: boolean; adapterKey: string | null; syncIntervalMinutes: number | null; minIntervalMinutes: number;
  nextSyncAt: Date | null; backoffUntil: Date | null; lastSyncAttemptAt: Date | null; lastSyncSuccessAt: Date | null;
  syncFailureCount: number; lastSyncErrorCategory: string | null;
};

const hours = (env: Record<string, string | undefined>, key: string, fallback: number, max: number) => {
  const raw = env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > max) throw new Error(`Invalid ${key} configuration.`);
  return n;
};
const severities = ["ROUTINE", "MATERIAL", "CRITICAL"] as const;
export type Severity = typeof severities[number];
export const changeKinds = ["NEW_PRODUCT", "POSSIBLE_DUPLICATE", "IDENTITY_CONFLICT", "INSUFFICIENT_INFORMATION", "OUTSOLE_CHANGE", "SKU_CHANGE", "SAFETY_SPEC_CHANGE", "SPEC_CONTRADICTION", "SPEC_NEW_VALUE", "SPEC_CORROBORATION", "IMAGE_ADDED", "IMAGE_REMOVED", "IMAGE_REMOVED_NONPUBLIC", "SOURCE_METADATA"] as const;
export type ChangeKind = typeof changeKinds[number];
// Documented default policy. Anything that would alter public catalogue data is at least MATERIAL.
export const defaultSeverity: Record<ChangeKind, Severity> = {
  NEW_PRODUCT: "MATERIAL", POSSIBLE_DUPLICATE: "MATERIAL", IDENTITY_CONFLICT: "CRITICAL", INSUFFICIENT_INFORMATION: "ROUTINE",
  OUTSOLE_CHANGE: "CRITICAL", SKU_CHANGE: "CRITICAL", SAFETY_SPEC_CHANGE: "CRITICAL",
  SPEC_CONTRADICTION: "MATERIAL", SPEC_NEW_VALUE: "MATERIAL", SPEC_CORROBORATION: "ROUTINE",
  IMAGE_ADDED: "MATERIAL", IMAGE_REMOVED: "MATERIAL", IMAGE_REMOVED_NONPUBLIC: "ROUTINE", SOURCE_METADATA: "ROUTINE",
};

/** Validated runtime configuration. Invalid values fail loudly rather than silently weakening limits. */
export function syncConfig(env: Record<string, string | undefined>) {
  let overrides: Partial<Record<ChangeKind, Severity>> = {};
  if (env.SYNC_SEVERITY_OVERRIDES) overrides = z.partialRecord(z.enum(changeKinds), z.enum(severities)).parse(JSON.parse(env.SYNC_SEVERITY_OVERRIDES));
  return {
    priceFreshHours: hours(env, "SYNC_PRICE_FRESH_HOURS", 24, 24 * 7),
    stockFreshHours: hours(env, "SYNC_STOCK_FRESH_HOURS", 12, 24 * 7),
    // Public price evidence expires on its own; never longer than the Finder's 7-day price rule.
    priceEvidenceHours: hours(env, "SYNC_PRICE_EVIDENCE_HOURS", 48, 24 * 7),
    priceRefreshHours: hours(env, "SYNC_PRICE_REFRESH_HOURS", 24, 24 * 7),
    authorizationReviewDays: hours(env, "SYNC_AUTHORIZATION_REVIEW_DAYS", 180, 3650),
    staleFeedMultiplier: hours(env, "SYNC_STALE_FEED_MULTIPLIER", 3, 50),
    leaseMinutes: hours(env, "SYNC_LEASE_MINUTES", 15, 240),
    longRunningMinutes: hours(env, "SYNC_LONG_RUNNING_MINUTES", 30, 1440),
    baseBackoffMinutes: hours(env, "SYNC_BACKOFF_BASE_MINUTES", 5, 1440),
    maxBackoffHours: hours(env, "SYNC_BACKOFF_MAX_HOURS", 24, 168),
    failingAfter: hours(env, "SYNC_FAILING_AFTER", 3, 100),
    severity: Object.fromEntries(changeKinds.map(k => [k, overrides[k] && severities.indexOf(overrides[k]!) > severities.indexOf(defaultSeverity[k]) ? overrides[k]! : defaultSeverity[k]])) as Record<ChangeKind, Severity>,
  };
}
export type SyncConfig = ReturnType<typeof syncConfig>;

export function classifyChange(kind: ChangeKind, config: SyncConfig) {
  const severity = config.severity[kind];
  return { severity, disposition: severity === "ROUTINE" ? "RECORDED" as const : "PENDING_REVIEW" as const };
}

const availabilityStates = ["IN_STOCK", "OUT_OF_STOCK", "PREORDER", "DISCONTINUED", "UNKNOWN"] as const;
export type Availability = typeof availabilityStates[number];
/** Per-source field policy. RECORD monitors privately; AUTO additionally publishes authorized price evidence. */
export function fieldPolicy(raw: unknown) {
  const mode = z.enum(["AUTO", "RECORD", "OFF"]).catch("RECORD");
  const parsed = z.object({ prices: mode.default("RECORD"), availability: mode.default("RECORD"), availabilityLabels: z.record(z.string().max(60), z.enum(availabilityStates)).catch({}).default({}) }).catch({ prices: "RECORD", availability: "RECORD", availabilityLabels: {} }).parse(raw ?? {});
  return { ...parsed, availabilityLabels: Object.fromEntries(Object.entries(parsed.availabilityLabels).slice(0, 50).map(([k, v]) => [k.trim().toLowerCase(), v])) };
}

export type Eligibility = { eligible: boolean; reason: "DUE" | "NOT_DUE" | "DISABLED" | "NOT_AUTHORIZED" | "AUTHORIZATION_REVIEW_DUE" | "SOURCE_ARCHIVED" | "NO_ADAPTER" | "BACKOFF" | "MIN_INTERVAL" };
export function eligibility(s: SourceState, trigger: Trigger, now: Date, config: SyncConfig, registered: (key: string) => boolean): Eligibility {
  const no = (reason: Eligibility["reason"]): Eligibility => ({ eligible: false, reason });
  if (s.status !== "ACTIVE") return no("SOURCE_ARCHIVED");
  // A reachable feed never implies permission: documented GRANTED/NOT_REQUIRED is mandatory, even for manual runs.
  if (!["GRANTED", "NOT_REQUIRED"].includes(s.authorizationStatus) || !s.permissionNotes || !s.permissionUrl || !s.authorizationCheckedAt) return no("NOT_AUTHORIZED");
  if (now.getTime() - s.authorizationCheckedAt.getTime() > config.authorizationReviewDays * 86_400_000) return no("AUTHORIZATION_REVIEW_DUE");
  if (!s.adapterKey || !registered(s.adapterKey)) return no("NO_ADAPTER");
  if (trigger === "SCHEDULED" && (!s.syncEnabled || !s.syncIntervalMinutes)) return no("DISABLED");
  if (s.backoffUntil && s.backoffUntil > now) return no("BACKOFF");
  if (s.lastSyncAttemptAt && now.getTime() - s.lastSyncAttemptAt.getTime() < s.minIntervalMinutes * 60_000) return no("MIN_INTERVAL");
  if (trigger === "SCHEDULED" && s.nextSyncAt && s.nextSyncAt > now) return no("NOT_DUE");
  return { eligible: true, reason: "DUE" };
}

/** Exponential backoff with ±20% jitter, capped; a longer provider Retry-After always wins. */
export function backoffMs(category: ErrorCategory, failures: number, retryAfterMs: number, config: SyncConfig, random: () => number = Math.random) {
  const cap = config.maxBackoffHours * 3_600_000;
  if (isPermanent(category)) return Math.max(cap, retryAfterMs);
  const base = config.baseBackoffMinutes * 60_000 * 2 ** Math.min(Math.max(failures, 1) - 1, 20);
  const jittered = Math.min(cap, Math.round(base * (0.8 + 0.4 * random())));
  return Math.max(jittered, Math.min(retryAfterMs, 7 * 24 * 3_600_000));
}

export type Health = "HEALTHY" | "DEGRADED" | "FAILING" | "DISABLED" | "NEVER_SYNCHRONIZED";
export function sourceHealth(s: SourceState, openAlerts: number, now: Date, config: SyncConfig): Health {
  if (s.status !== "ACTIVE" || !s.syncEnabled || !["GRANTED", "NOT_REQUIRED"].includes(s.authorizationStatus)) return "DISABLED";
  if (!s.lastSyncAttemptAt) return "NEVER_SYNCHRONIZED";
  const failed = s.syncFailureCount > 0;
  if (failed && (s.syncFailureCount >= config.failingAfter || isPermanent(s.lastSyncErrorCategory as ErrorCategory))) return "FAILING";
  const staleAfter = (s.syncIntervalMinutes ?? 1440) * 60_000 * config.staleFeedMultiplier;
  if (failed || openAlerts > 0 || !s.lastSyncSuccessAt || now.getTime() - s.lastSyncSuccessAt.getTime() > staleAfter) return "DEGRADED";
  return "HEALTHY";
}
