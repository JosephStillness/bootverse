import "server-only";
import { readFile, realpath } from "node:fs/promises";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { request } from "node:https";
import { resolve, sep } from "node:path";
import { FeedFailure, FeedRetryError, type FeedAdapter } from "@/lib/data-import/adapter";
import { interpretStatus, isBlockedAddress, validateFeedUrl } from "./feed";

/**
 * Server-side adapter registry. Sources reference adapters by key only; URLs and credentials come from
 * server environment variables and are never stored in PostgreSQL or sent to browsers.
 *   fixture:<name>  local synthetic JSON (only when SYNC_FIXTURES_ENABLED=1)
 *   http:<name>     SYNC_HTTP_FEEDS=<name>, SYNC_FEED_<NAME>_URL, optional SYNC_FEED_<NAME>_TOKEN / _MODE,
 *                   host must also be listed in SYNC_ALLOWED_HOSTS
 */
export type SyncAdapter = FeedAdapter & { key: string; mode: "SNAPSHOT" | "DELTA"; settings: { maxPages: number; maxRows: number; timeoutMs: number; minIntervalMs: number }; credentials: Readonly<Record<string, string>>; secrets: string[] };
export type AdapterInfo = { key: string; kind: "fixture" | "http"; mode: "SNAPSHOT" | "DELTA"; host: string | null };
type Env = Record<string, string | undefined>;

const PAGE = 500;
const keyPattern = /^(fixture|http):([a-z0-9-]{1,60})$/;
const fixtureRoot = (env: Env) => resolve(env.SYNC_FIXTURE_DIR ?? "fixtures/sync");
const envName = (name: string) => name.toUpperCase().replace(/-/g, "_");

export function listAdapters(env: Env = process.env): AdapterInfo[] {
  const out: AdapterInfo[] = [];
  for (const name of (env.SYNC_HTTP_FEEDS ?? "").split(",").map(s => s.trim()).filter(n => /^[a-z0-9-]{1,60}$/.test(n))) {
    const url = env[`SYNC_FEED_${envName(name)}_URL`];
    try { const u = validateFeedUrl(url ?? "", (env.SYNC_ALLOWED_HOSTS ?? "").split(",")); out.push({ key: `http:${name}`, kind: "http", mode: env[`SYNC_FEED_${envName(name)}_MODE`] === "DELTA" ? "DELTA" : "SNAPSHOT", host: u.hostname }); } catch { /* misconfigured feeds are not offered */ }
  }
  return out;
}
export function isRegistered(key: string, env: Env = process.env) {
  const m = key.match(keyPattern);
  if (!m) return false;
  // Synthetic fixtures are opt-in per environment and never enabled by default.
  if (m[1] === "fixture") return env.SYNC_FIXTURES_ENABLED === "1";
  return listAdapters(env).some(a => a.key === key);
}

async function loadFixture(name: string, env: Env) {
  const root = await realpath(fixtureRoot(env));
  // Resolve symlinks and require the file to sit inside the fixture root (no path traversal).
  const file = await realpath(resolve(root, `${name}.json`)).catch(() => { throw new FeedFailure("CONFIG", 0, "Feed fixture is not available."); });
  if (!file.startsWith(root + sep)) throw new FeedFailure("CONFIG", 0, "Feed fixture is not available.");
  const text = await readFile(file, "utf8");
  if (Buffer.byteLength(text) > 20 * 1024 * 1024) throw new FeedFailure("INVALID_FEED", 0, "Feed response is malformed.");
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new FeedFailure("INVALID_FEED", 0, "Feed response is malformed."); }
  const body = parsed as { mode?: string; records?: unknown; failure?: { status: number; retryAfterSeconds?: number } };
  if (!Array.isArray(body.records)) throw new FeedFailure("INVALID_FEED", 0, "Feed response is malformed.");
  return { mode: body.mode === "DELTA" ? "DELTA" as const : "SNAPSHOT" as const, records: body.records, failure: body.failure };
}

/** HTTPS GET of a JSON page. Every resolved address is checked at connect time, so DNS rebinding cannot reach private hosts. */
export function secureGetJson(url: URL, headers: Record<string, string>, signal: AbortSignal, maxBytes = 10 * 1024 * 1024) {
  return new Promise<unknown>((resolvePromise, reject) => {
    const req = request(url, {
      method: "GET", headers: { Accept: "application/json", "User-Agent": "BootVerse-Sync/1", ...headers }, agent: false, signal, timeout: 30_000,
      lookup: (hostname, options, callback) => dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
        if (error) return (callback as (e: Error) => void)(error);
        const list = addresses as unknown as LookupAddress[];
        if (!list.length || list.some(a => isBlockedAddress(a.address, a.family))) return (callback as (e: Error) => void)(new Error("blocked_address"));
        if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, list);
        (callback as (e: null, address: string, family: number) => void)(null, list[0].address, list[0].family);
      }),
    }, response => {
      const status = interpretStatus(response.statusCode ?? 0, (response.headers["retry-after"] as string | undefined) ?? null);
      if (status.kind !== "OK") { response.resume(); return reject(status.kind === "RETRY" ? new FeedRetryError(response.statusCode ?? 503, status.retryAfterMs) : new FeedFailure(status.category)); }
      if (!/^application\/(.+\+)?json\b/i.test(String(response.headers["content-type"] ?? ""))) { response.resume(); return reject(new FeedFailure("INVALID_FEED", 0, "Feed response is malformed.")); }
      let size = 0; const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => { size += chunk.length; if (size > maxBytes) { req.destroy(); reject(new FeedFailure("INVALID_FEED", 0, "Feed response is too large.")); } else chunks.push(chunk); });
      response.on("end", () => { try { resolvePromise(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch { reject(new FeedFailure("INVALID_FEED", 0, "Feed response is malformed.")); } });
    });
    req.on("timeout", () => req.destroy(new FeedFailure("TIMEOUT")));
    req.on("error", error => reject(error instanceof FeedFailure || error instanceof FeedRetryError ? error : new FeedFailure(signal.aborted ? "CANCELLED" : "UNAVAILABLE")));
    req.end();
  });
}

export async function adapterFor(key: string, env: Env = process.env): Promise<SyncAdapter> {
  const m = key.match(keyPattern);
  if (!m || !isRegistered(key, env)) throw new FeedFailure("CONFIG", 0, "This source has no enabled server adapter.");
  const settings = { maxPages: 20, maxRows: 5000, timeoutMs: 30_000, minIntervalMs: 0 };
  if (m[1] === "fixture") {
    const fixture = await loadFixture(m[2], env);
    return {
      key, sourceId: key, mode: fixture.mode, settings, credentials: {}, secrets: [],
      async page({ cursor }) {
        if (fixture.failure) throw fixture.failure.status === 401 || fixture.failure.status === 403 ? new FeedFailure("AUTHORIZATION") : new FeedRetryError(fixture.failure.status, (fixture.failure.retryAfterSeconds ?? 0) * 1000);
        const at = cursor ? Number(cursor) : 0;
        if (!Number.isInteger(at) || at < 0) throw new FeedFailure("INVALID_FEED", 0, "Feed response is malformed.");
        const next = at + PAGE;
        return { records: fixture.records.slice(at, next), nextCursor: next < fixture.records.length ? String(next) : null };
      },
    };
  }
  const name = envName(m[2]);
  const url = validateFeedUrl(env[`SYNC_FEED_${name}_URL`] ?? "", (env.SYNC_ALLOWED_HOSTS ?? "").split(","));
  const token = env[`SYNC_FEED_${name}_TOKEN`];
  return {
    key, sourceId: key, mode: env[`SYNC_FEED_${name}_MODE`] === "DELTA" ? "DELTA" : "SNAPSHOT", settings: { ...settings, minIntervalMs: 1000 },
    credentials: token ? { token } : {}, secrets: token ? [token] : [],
    async page({ cursor, signal, credentials }) {
      const target = new URL(url);
      if (cursor) target.searchParams.set("cursor", cursor);
      const body = await secureGetJson(target, credentials.token ? { Authorization: `Bearer ${credentials.token}` } : {}, signal) as { records?: unknown; nextCursor?: unknown };
      if (!body || !Array.isArray(body.records) || !(body.nextCursor === null || typeof body.nextCursor === "string")) throw new FeedFailure("INVALID_FEED", 0, "Feed response is malformed.");
      return { records: body.records, nextCursor: body.nextCursor as string | null };
    },
  };
}
