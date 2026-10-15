import { z } from "zod";

const reservedUsernames = new Set([
  "admin",
  "administrator",
  "moderator",
  "bootverse",
  "support",
  "api",
  "account",
  "login",
  "register",
]);
export const usernameSchema = z
  .string()
  .trim()
  .normalize("NFC")
  .toLowerCase()
  .min(3)
  .max(30)
  .regex(
    /^[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:[-_][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*$/u,
    "Use Unicode letters, numbers, and single hyphens or underscores.",
  )
  .refine(
    (value) => !reservedUsernames.has(value),
    "This username is reserved.",
  );
// Route parameters may arrive percent-encoded; valid handles never contain a percent sign.
export function routeUsername(value: string) {
  try { return usernameSchema.safeParse(decodeURIComponent(value)); }
  catch { return usernameSchema.safeParse(""); }
}
export const profileSchema = z
  .object({
    username: usernameSchema,
    displayName: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .regex(/^[^\u0000-\u001f\u007f]+$/, "Remove control characters."),
    bio: z
      .string()
      .trim()
      .max(300)
      .refine(
        (value) =>
          !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value),
        "Remove control characters.",
      ),
  })
  .strict();
export const emailSchema = z.email().trim().toLowerCase().max(254);
export type ProfileInput = z.infer<typeof profileSchema>;

export function safeReturnPath(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 2000 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u0020]/.test(value)
  )
    return "/account";
  try {
    const url = new URL(value, "https://bootverse.local");
    if (
      url.origin !== "https://bootverse.local" ||
      url.pathname.startsWith("/api/") ||
      url.pathname === "/login" ||
      url.pathname === "/register"
    )
      return "/account";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/account";
  }
}
