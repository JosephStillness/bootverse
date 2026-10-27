// Machine-to-machine authentication for the internal scheduler endpoint. Pure; nonce storage is the caller's.
import { createHmac, timingSafeEqual } from "node:crypto";

export const SKEW_MS = 5 * 60_000;
export function sign(secret: string, timestamp: string, nonce: string, body: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${nonce}.${body}`).digest("hex");
}
/**
 * A secret URL alone is never accepted: every request carries a fresh timestamp, a single-use nonce and an
 * HMAC over both plus the exact body. Returns the nonce to persist (replay check) when the signature is valid.
 */
export function verifySchedulerRequest(secret: string | undefined, headers: { timestamp: string | null; nonce: string | null; signature: string | null }, body: string, now = Date.now()) {
  if (!secret || secret.length < 32) return { ok: false as const, status: 404 };
  const { timestamp, nonce, signature } = headers;
  if (!timestamp || !nonce || !signature || !/^\d{10,13}$/.test(timestamp) || !/^[A-Za-z0-9_-]{16,64}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(signature)) return { ok: false as const, status: 401 };
  const ms = timestamp.length === 13 ? Number(timestamp) : Number(timestamp) * 1000;
  if (Math.abs(now - ms) > SKEW_MS) return { ok: false as const, status: 401 };
  const expected = Buffer.from(sign(secret, timestamp, nonce, body), "hex"), given = Buffer.from(signature, "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false as const, status: 401 };
  return { ok: true as const, nonce };
}
