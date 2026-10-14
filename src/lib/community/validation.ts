import { z } from "zod";
import { usernameSchema } from "../accounts/validation";
export const categories = [
  { id: "questions", name: "Questions" },
  { id: "boot-reviews", name: "Boot Reviews" },
  { id: "comparisons", name: "Comparisons" },
  { id: "sizing-help", name: "Sizing Help" },
  { id: "general-discussion", name: "General Discussion" },
] as const;
const category = z.enum([
  "questions",
  "boot-reviews",
  "comparisons",
  "sizing-help",
  "general-discussion",
]);
const tag = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(24)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use letters, numbers and single hyphens.",
  );
export const text = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine(
      (value) => Array.from(value).length >= min,
      `Use at least ${min} characters.`,
    )
    .refine(
      (value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value),
      "Remove control characters.",
    );
export const postSchema = z
  .object({
    title: text(5, 160),
    content: text(20, 10000),
    categoryId: category,
    tags: z
      .array(tag)
      .max(5)
      .transform((value) => [...new Set(value)].sort()),
    bootEntryId: z.string().min(1).max(100).nullable(),
  })
  .strict();
export const editPostSchema = postSchema.extend({
  version: z.number().int().min(1).max(2147483646),
});
export const deletePostSchema = z
  .object({ version: z.number().int().min(1).max(2147483646) })
  .strict();
export type PostInput = z.infer<typeof postSchema>;
export const feedSchema = z.object({
  q: z.string().trim().max(100).default(""),
  category: z.union([category, z.literal("")]).default(""),
  tag: z.union([tag, z.literal("")]).default(""),
  boot: z.string().max(100).default(""),
  author: z.union([usernameSchema, z.literal("")]).default(""),
  sort: z.enum(["newest", "oldest", "popular", "discussed"]).default("newest"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export type FeedFilters = z.infer<typeof feedSchema>;
export function feedQuery(params: URLSearchParams) {
  return feedSchema.parse(
    Object.fromEntries(
      ["q", "category", "tag", "boot", "author", "sort", "page"].map((key) => [
        key,
        params.get(key) ?? undefined,
      ]),
    ),
  );
}
export function feedHref(
  filters: FeedFilters,
  overrides: Partial<FeedFilters> = {},
) {
  const values = { ...filters, ...overrides },
    query = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (
      value !== "" &&
      !(key === "sort" && value === "newest") &&
      !(key === "page" && value === 1)
    )
      query.set(key, String(value));
  return `/community${query.size ? `?${query}` : ""}`;
}
export function postExcerpt(content: string) {
  return content
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/!?(\[([^\]]*)\])\([^)]*\)/g, "$2")
    .replace(/<[^>]*>/g, "")
    .replace(/[#*`>_~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}
// Only web links and same-site relative links; no embedded remote images.
export function safeMarkdownUrl(value: string) {
  if (!value || /[\u0000-\u0020\\]/.test(value)) return "";
  try {
    const url = new URL(value, "https://bootverse.local");
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return "";
    return value;
  } catch {
    return "";
  }
}
