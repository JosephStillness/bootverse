import { describe, expect, it } from "vitest";
import { interpretStatus, isBlockedAddress, redact, splitRecords, validateFeedUrl } from "./feed";

describe("D5 feed envelope", () => {
  it("separates products and offers and rejects anything else", () => {
    const r = splitRecords([{ kind: "product", recordId: "a" }, { kind: "offer", recordId: "a" }, { kind: "product", recordId: "b", offers: [] }, { kind: "html" }, "text", null]);
    expect(r.products).toEqual([{ recordId: "a" }]); expect(r.offers).toHaveLength(1); expect(r.malformed).toBe(4);
  });
});

describe("D5 SSRF protections", () => {
  it.each([["127.0.0.1", 4], ["10.1.2.3", 4], ["169.254.169.254", 4], ["172.20.0.1", 4], ["192.168.1.1", 4], ["100.64.0.1", 4], ["0.0.0.0", 4], ["::1", 6], ["fd00::1", 6], ["fe80::1", 6], ["::ffff:127.0.0.1", 6], ["::ffff:10.0.0.1", 6], ["2001:db8::1", 6], ["not-an-ip", 4]])("blocks %s", (ip, family) => expect(isBlockedAddress(ip, family)).toBe(true));
  it.each([["93.184.216.34", 4], ["2606:2800:220:1:248:1893:25c8:1946", 6]])("allows public %s", (ip, family) => expect(isBlockedAddress(ip, family)).toBe(false));
  it("accepts only allowlisted HTTPS hosts without credentials or secret query parameters", () => {
    expect(validateFeedUrl("https://feeds.example.test/v1/products", ["feeds.example.test"]).hostname).toBe("feeds.example.test");
    for (const url of ["http://feeds.example.test/x", "https://user:pw@feeds.example.test/x", "https://other.example.test/x", "https://127.0.0.1/x", "https://feeds.example.test/x?api_key=abc", "file:///etc/passwd", "not a url"])
      expect(() => validateFeedUrl(url, ["feeds.example.test", "127.0.0.1"])).toThrow();
  });
});

describe("D5 provider responses", () => {
  it("retries rate limits and server errors honouring Retry-After", () => {
    expect(interpretStatus(429, "120")).toEqual({ kind: "RETRY", retryAfterMs: 120_000 });
    expect(interpretStatus(503, new Date(Date.UTC(2026, 9, 27, 0, 1)).toUTCString(), Date.UTC(2026, 9, 27, 0, 0))).toEqual({ kind: "RETRY", retryAfterMs: 60_000 });
  });
  it("never retries authorization failures, refuses redirects and treats 404 as configuration", () => {
    expect(interpretStatus(401, null)).toMatchObject({ kind: "FAIL", category: "AUTHORIZATION" });
    expect(interpretStatus(302, null)).toMatchObject({ kind: "FAIL", category: "CONFIG" });
    expect(interpretStatus(404, null)).toMatchObject({ kind: "FAIL", category: "CONFIG" });
  });
  it("redacts configured secrets and credential-looking values", () => {
    const out = redact("failed with token=abc123secret and key SUPERSECRETVALUE", ["SUPERSECRETVALUE"]);
    expect(out).not.toContain("abc123secret"); expect(out).not.toContain("SUPERSECRETVALUE");
  });
});
