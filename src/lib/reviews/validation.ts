import { z } from "zod";
import { text } from "../community/validation";
import { usernameSchema } from "../accounts/validation";
export const criteria = {
  comfort: "Comfort",
  fit: "Fit satisfaction",
  traction: "Traction",
  ballTouch: "Ball touch",
  durability: "Durability",
  value: "Value for money",
} as const;
export type Criterion = keyof typeof criteria;
export const footShapes = ["narrow", "average", "wide", "unsure"] as const;
export const widthObservations = [
  "too-narrow",
  "slightly-narrow",
  "expected",
  "slightly-wide",
  "too-wide",
] as const;
const optionalText = (max: number) => text(1, max).nullable().default(null);
const rating = z.number().int().min(1).max(5);
export const reviewSchema = z
  .object({
    variantId: text(1, 100),
    sizeWorn: z
      .string()
      .trim()
      .regex(/^\d{1,3}(?:\.(?:0|5))?$/, "Use a numeric size, such as 9 or 9.5.")
      .refine(
        (x) => Number(x) > 0 && Number(x) <= 100,
        "Size must be between 0 and 100.",
      ),
    sizeSystem: z.enum(["UK", "US", "EU", "CM"]),
    ownershipMonths: z.number().int().min(0).max(600),
    matchesPlayed: z.number().int().min(0).max(10000),
    experience: text(40, 5000),
    sponsorship: optionalText(120),
    pros: text(3, 1500),
    cons: text(3, 1500),
    comfort: rating,
    fit: rating,
    traction: rating,
    ballTouch: rating,
    durability: rating,
    value: rating,
    footLengthCm: z
      .number()
      .min(10)
      .max(40)
      .multipleOf(0.1)
      .nullable()
      .default(null),
    footWidthCm: z
      .number()
      .min(3)
      .max(20)
      .multipleOf(0.1)
      .nullable()
      .default(null),
    footShape: z.enum(footShapes).nullable().default(null),
    shareFootInfo: z.boolean().default(false),
    position: optionalText(50),
    playingSurface: z
      .enum(["FG", "AG", "TF", "SG", "IN", "OTHER"])
      .nullable()
      .default(null),
    widthObservation: z.enum(widthObservations).nullable().default(null),
    toeRoom: optionalText(300),
    midfootPressure: optionalText(300),
    heelLockdown: optionalText(300),
    breakIn: optionalText(300),
    sizingAdvice: optionalText(300),
    purchasePrice: z
      .number()
      .min(0)
      .max(99999999.99)
      .multipleOf(0.01)
      .nullable()
      .default(null),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/, "Use a three-letter currency code.")
      .nullable()
      .default(null),
  })
  .strict()
  .refine((x) => (x.purchasePrice === null) === (x.currency === null), {
    path: ["currency"],
    message: "Provide both purchase price and currency, or neither.",
  });
export const editReviewSchema = reviewSchema.safeExtend({
  version: z.number().int().min(1).max(2147483646),
});
export const helpfulSchema = z.object({ helpful: z.boolean() }).strict();
export type ReviewInput = z.infer<typeof reviewSchema>;
export function ratingTotal(input: Pick<ReviewInput, Criterion>) {
  return (Object.keys(criteria) as Criterion[]).reduce(
    (sum, key) => sum + input[key],
    0,
  );
}
export function overall(input: Pick<ReviewInput, Criterion>) {
  return ratingTotal(input) / 6;
}
export const reviewQuerySchema = z.object({
  variant: z.string().max(100).default(""),
  author: z.union([usernameSchema, z.literal("")]).default(""),
  size: z.string().max(12).default(""),
  system: z.enum(["", "UK", "US", "EU", "CM"]).default(""),
  shape: z.enum(["", ...footShapes]).default(""),
  surface: z.enum(["", "FG", "AG", "TF", "SG", "IN", "OTHER"]).default(""),
  duration: z.enum(["", "under-3", "3-12", "over-12"]).default(""),
  sort: z.enum(["recent", "highest", "lowest", "helpful"]).default("recent"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export type ReviewQuery = z.infer<typeof reviewQuerySchema>;
export function reviewQuery(params: URLSearchParams) {
  return reviewQuerySchema.parse(
    Object.fromEntries(
      [
        "variant",
        "author",
        "size",
        "system",
        "shape",
        "surface",
        "duration",
        "sort",
        "page",
      ].map((key) => [key, params.get(key) ?? undefined]),
    ),
  );
}
