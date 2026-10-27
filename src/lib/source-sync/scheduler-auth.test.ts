import { describe, expect, it } from "vitest";
import { sign, verifySchedulerRequest } from "./scheduler-auth";

const secret = "s".repeat(48), body = JSON.stringify({ action: "due" }), now = Date.UTC(2026, 9, 27, 12);
const ts = String(Math.floor(now / 1000)), nonce = "nonce-0123456789abcdef";
const headers = (over: Partial<Record<"timestamp" | "nonce" | "signature", string | null>> = {}) => ({ timestamp: ts, nonce, signature: sign(secret, ts, nonce, body), ...over });

describe("D5 scheduler endpoint authentication", () => {
  it("accepts a fresh, correctly signed request", () => expect(verifySchedulerRequest(secret, headers(), body, now)).toEqual({ ok: true, nonce }));
  it("is disabled (404) without a strong configured secret", () => {
    expect(verifySchedulerRequest(undefined, headers(), body, now).status).toBe(404);
    expect(verifySchedulerRequest("short-secret", headers(), body, now).status).toBe(404);
  });
  it("rejects missing headers, a wrong secret, a tampered body and stale timestamps", () => {
    expect(verifySchedulerRequest(secret, headers({ signature: null }), body, now).status).toBe(401);
    expect(verifySchedulerRequest(secret, headers({ signature: sign("x".repeat(48), ts, nonce, body) }), body, now).status).toBe(401);
    expect(verifySchedulerRequest(secret, headers(), JSON.stringify({ action: "sweep" }), now).status).toBe(401);
    expect(verifySchedulerRequest(secret, headers(), body, now + 6 * 60_000).status).toBe(401);
    expect(verifySchedulerRequest(secret, headers({ nonce: "../short" }), body, now).status).toBe(401);
  });
});
