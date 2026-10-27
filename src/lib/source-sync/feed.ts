// D5 feed envelope: D2 version-1 product records plus listing-level offer records.
import { z } from "zod";

export type SplitFeed = { products: Record<string, unknown>[]; offers: Record<string, unknown>[]; malformed: number };
/**
 * Records carry kind "product" (a D2 record without inline offers) or "offer".
 * Anything else is counted as malformed and rejected; nothing is guessed.
 */
export function splitRecords(records: unknown[]): SplitFeed {
  const out: SplitFeed = { products: [], offers: [], malformed: 0 };
  for (const record of records) {
    const parsed = z.record(z.string(), z.unknown()).safeParse(record);
    if (!parsed.success) { out.malformed++; continue; }
    const { kind, ...rest } = parsed.data;
    if (kind === "product" && !("offers" in rest)) out.products.push(rest);
    else if (kind === "offer") out.offers.push(parsed.data);
    else out.malformed++;
  }
  return out;
}

const blocked: [number, number][] = [];
const v4 = (cidr: string) => { const [ip, bits] = cidr.split("/"); const n = ip.split(".").reduce((a, o) => a * 256 + Number(o), 0); blocked.push([n, Number(bits)]); };
// Loopback, private, link-local (incl. cloud metadata), CGNAT, documentation, benchmarking, multicast and reserved ranges.
["0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12", "192.0.0.0/24", "192.0.2.0/24", "192.88.99.0/24", "192.168.0.0/16", "198.18.0.0/15", "198.51.100.0/24", "203.0.113.0/24", "224.0.0.0/4", "240.0.0.0/4"].forEach(v4);
function ipv4Blocked(ip: string) {
  const parts = ip.split(".");
  if (parts.length !== 4 || parts.some(p => !/^\d{1,3}$/.test(p) || Number(p) > 255)) return true;
  const n = parts.reduce((a, o) => a * 256 + Number(o), 0);
  return blocked.some(([net, bits]) => Math.floor(n / 2 ** (32 - bits)) === Math.floor(net / 2 ** (32 - bits)));
}
/** True for any address a server-side feed request must never reach. Unparseable input is blocked. */
export function isBlockedAddress(address: string, family: number) {
  if (family === 4) return ipv4Blocked(address);
  const ip = address.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4Blocked(mapped[1]);
  if (ip === "::" || ip === "::1") return true;
  const first = parseInt(ip.split(":")[0] || "0", 16);
  if (Number.isNaN(first)) return true;
  // fc00::/7 unique-local, fe80::/10 link-local, ff00::/8 multicast, 2001:db8::/32 docs, 64:ff9b::/96 NAT64, ::ffff:0:0/96 handled above.
  if ((first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80 || (first & 0xff00) === 0xff00) return true;
  if (ip.startsWith("2001:db8:") || ip.startsWith("64:ff9b:") || ip.startsWith("::")) return true;
  return false;
}

/** Validates an operator-configured feed URL. User input never reaches this; it comes from server env only. */
export function validateFeedUrl(raw: string, allowedHosts: string[]) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("feed_url_invalid"); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error("feed_url_invalid");
  const host = url.hostname.toLowerCase();
  if (!allowedHosts.map(h => h.trim().toLowerCase()).filter(Boolean).includes(host)) throw new Error("feed_host_not_allowed");
  if (/^[\d.]+$/.test(host) || host.includes(":")) throw new Error("feed_url_literal_ip");
  if (Array.from(url.searchParams.keys()).some(k => /token|secret|signature|api.?key|password|credential|auth|sig$/i.test(k))) throw new Error("feed_url_secret_query");
  return url;
}

/** Maps a provider HTTP status to retry semantics. Redirects are refused (they could leave the allowlist). */
export function interpretStatus(status: number, retryAfter: string | null, now = Date.now()) {
  const retryAfterMs = (() => {
    if (!retryAfter) return 0;
    if (/^\d{1,7}$/.test(retryAfter.trim())) return Number(retryAfter.trim()) * 1000;
    const at = Date.parse(retryAfter);
    return Number.isFinite(at) ? Math.max(0, at - now) : 0;
  })();
  if (status >= 200 && status < 300) return { kind: "OK" as const, retryAfterMs: 0 };
  if (status >= 300 && status < 400) return { kind: "FAIL" as const, category: "CONFIG" as const, retryAfterMs: 0 };
  if (status === 401 || status === 403) return { kind: "FAIL" as const, category: "AUTHORIZATION" as const, retryAfterMs: 0 };
  if (status === 429 || status >= 500) return { kind: "RETRY" as const, retryAfterMs: Math.min(retryAfterMs, 7 * 86_400_000) };
  if (status === 404 || status === 410) return { kind: "FAIL" as const, category: "CONFIG" as const, retryAfterMs: 0 };
  return { kind: "FAIL" as const, category: "UNAVAILABLE" as const, retryAfterMs: 0 };
}

/** Removes any configured secret value from text before it can reach logs or the database. */
export function redact(text: string, secrets: (string | undefined)[]) {
  let out = text;
  for (const s of secrets) if (s && s.length >= 6) out = out.split(s).join("[redacted]");
  return out.replace(/(bearer|token|api[_-]?key|password|secret)(["'=:\s]+)[^\s"',;]+/gi, "$1$2[redacted]").slice(0, 300);
}
