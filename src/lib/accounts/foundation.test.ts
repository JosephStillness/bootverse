import { afterEach, describe, expect, it, vi } from "vitest";
import {
  requireActiveUser,
  requireOwner,
  requireModerator,
  type Principal,
} from "./authorization";
import { routeUsername, emailSchema, profileSchema, safeReturnPath } from "./validation";
import { authConfigured, sameOriginRequest } from "./config";
import { BodyTooLargeError, limitedText } from "./request";
import { trustedClientIp } from "./request-client";

const user: Principal = {
  id: "owner",
  role: "USER",
  status: "ACTIVE",
  emailVerified: new Date(),
};
afterEach(() => vi.unstubAllEnvs());
describe("server authorization", () => {
  it("rejects anonymous users", () =>
    expect(() => requireActiveUser(null)).toThrow("Sign in"));
  it("rejects unverified and suspended accounts", () => {
    expect(() => requireActiveUser({ ...user, emailVerified: null })).toThrow();
    expect(() => requireActiveUser({ ...user, status: "SUSPENDED" })).toThrow();
  });
  it("allows owners and rejects editing another profile, including admins", () => {
    expect(requireOwner(user, "owner")).toEqual(user);
    expect(() => requireOwner(user, "other")).toThrow();
    expect(() => requireOwner({ ...user, role: "ADMIN" }, "other")).toThrow();
  });
  it("requires moderator or admin role for moderation", () => {
    expect(() => requireModerator(user)).toThrow();
    expect(requireModerator({ ...user, role: "MODERATOR" }).role).toBe(
      "MODERATOR",
    );
    expect(requireModerator({ ...user, role: "ADMIN" }).role).toBe("ADMIN");
  });
});
describe("profile input", () => {
  const valid = {
    username: " Boot-Fan_7 ",
    displayName: " Alex ",
    bio: "Hello\nFootball",
  };
  it("supports Unicode handles with canonical normalization", () => {
    expect(profileSchema.parse({...valid, username:"Giày-Đá-Bóng"}).username).toBe("giày-đá-bóng");
    expect(profileSchema.safeParse({...valid,username:"日本の靴"}).success).toBe(true);
    expect(profileSchema.safeParse({...valid,username:"name/unsafe"}).success).toBe(false);
    expect(routeUsername(encodeURIComponent("giày-đá-bóng")).success).toBe(true);
    expect(routeUsername("%ZZ").success).toBe(false);
  });
  it("normalizes usernames and keeps text as text", () => {
    expect(profileSchema.parse(valid)).toEqual({
      username: "boot-fan_7",
      displayName: "Alex",
      bio: "Hello\nFootball",
    });
    expect(
      profileSchema.parse({ ...valid, bio: "<script>alert(1)</script>" }).bio,
    ).toContain("<script>");
  });
  it.each(["admin", "ADMIN", "a", "ab--cd", "foo/bar", "user@example.com"])(
    "rejects invalid/reserved username %s",
    (username) =>
      expect(profileSchema.safeParse({ ...valid, username }).success).toBe(
        false,
      ),
  );
  it("rejects privilege and ownership fields and excessive text", () => {
    expect(profileSchema.safeParse({ ...valid, role: "ADMIN" }).success).toBe(
      false,
    );
    expect(profileSchema.safeParse({ ...valid, userId: "other" }).success).toBe(
      false,
    );
    expect(
      profileSchema.safeParse({ ...valid, bio: "x".repeat(301) }).success,
    ).toBe(false);
    expect(
      profileSchema.safeParse({ ...valid, displayName: "\u0000bad" }).success,
    ).toBe(false);
  });
  it("normalizes single email addresses and rejects address lists", () => {
    expect(emailSchema.parse("Me@Example.com")).toBe("me@example.com");
    expect(emailSchema.safeParse("a@example.com,b@example.com").success).toBe(
      false,
    );
  });
});
describe("return links and CSRF", () => {
  it("ignores spoofable forwarded addresses unless the proxy header is configured", () => {
    vi.stubEnv("AUTH_TRUSTED_IP_HEADER", "");
    expect(
      trustedClientIp(
        new Request("http://localhost", {
          headers: { "x-real-ip": "192.0.2.1" },
        }),
      ),
    ).toBeNull();
  });
  it("validates and canonicalizes only the configured trusted header", () => {
    vi.stubEnv("AUTH_TRUSTED_IP_HEADER", "x-real-ip");
    expect(
      trustedClientIp(
        new Request("http://localhost", {
          headers: { "x-real-ip": "2001:0DB8:0:0::1" },
        }),
      ),
    ).toBe("[2001:db8::1]");
    expect(() =>
      trustedClientIp(
        new Request("http://localhost", {
          headers: { "x-forwarded-for": "192.0.2.1" },
        }),
      ),
    ).toThrow();
    expect(() =>
      trustedClientIp(
        new Request("http://localhost", {
          headers: { "x-real-ip": "192.0.2.1,192.0.2.2" },
        }),
      ),
    ).toThrow();
    vi.stubEnv("AUTH_TRUSTED_IP_HEADER", "x-forwarded-for");
    expect(() => trustedClientIp(new Request("http://localhost"))).toThrow();
  });
  it.each([
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/api/auth/signout",
    "/login",
    null,
    "/\nattack",
  ])("rejects unsafe return target %s", (target) =>
    expect(safeReturnPath(target)).toBe("/account"),
  );
  it("preserves internal navigation", () =>
    expect(safeReturnPath("/boots?brand=nike")).toBe("/boots?brand=nike"));
  it("requires configured origin, rejects missing/spoofed origins", () => {
    vi.stubEnv("AUTH_URL", "https://bootverse.example");
    expect(
      sameOriginRequest(
        new Request("https://bootverse.example/api/account/profile", {
          headers: { origin: "https://bootverse.example" },
        }),
      ),
    ).toBe(true);
    expect(
      sameOriginRequest(
        new Request("https://bootverse.example/api/account/profile"),
      ),
    ).toBe(false);
    expect(
      sameOriginRequest(
        new Request("https://bootverse.example/api/account/profile", {
          headers: { origin: "https://evil.test" },
        }),
      ),
    ).toBe(false);
  });
  it("fails closed on incomplete or insecure configuration", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/test");
    vi.stubEnv("AUTH_SECRET", "x".repeat(32));
    vi.stubEnv("EMAIL_SERVER", "smtp://localhost:1025");
    vi.stubEnv("EMAIL_FROM", "noreply@example.com");
    vi.stubEnv("AUTH_URL", "http://bootverse.example");
    expect(authConfigured()).toBe(false);
    vi.stubEnv("AUTH_URL", "https://bootverse.example");
    expect(authConfigured()).toBe(true);
    vi.stubEnv("AUTH_SECRET", "");
    expect(authConfigured()).toBe(false);
  });
  it("rejects invalid SMTP configuration while supporting Resend and local SMTP", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/test");
    vi.stubEnv("AUTH_SECRET", "x".repeat(32));
    vi.stubEnv("AUTH_URL", "http://localhost:3000");
    vi.stubEnv("EMAIL_FROM", "BootVerse <noreply@example.com>");
    vi.stubEnv("EMAIL_SERVER", "not-an-smtp-url");
    expect(authConfigured()).toBe(false);
    vi.stubEnv("EMAIL_SERVER", "https://smtp.resend.com");
    expect(authConfigured()).toBe(false);
    vi.stubEnv("EMAIL_SERVER", "smtps://smtp.resend.com:465");
    expect(authConfigured()).toBe(false);
    vi.stubEnv("EMAIL_SERVER", "smtps://resend:test-only@smtp.resend.com:465");
    expect(authConfigured()).toBe(true);
    vi.stubEnv("EMAIL_SERVER", "smtp://localhost:1025");
    expect(authConfigured()).toBe(true);
  });
  it("bounds request bodies by bytes without relying on content-length", async () => {
    expect(
      await limitedText(
        new Request("http://localhost", { method: "POST", body: "ok" }),
        2,
      ),
    ).toBe("ok");
    await expect(
      limitedText(
        new Request("http://localhost", { method: "POST", body: "éé" }),
        3,
      ),
    ).rejects.toBeInstanceOf(BodyTooLargeError);
  });
});
