import { describe, it, expect } from "vitest";
import {
  reviewSchema,
  editReviewSchema,
  overall,
  reviewQuery,
  helpfulSchema,
} from "./validation";
const valid = {
  variantId: "sample-variant",
  sizeWorn: "9.5",
  sizeSystem: "UK",
  ownershipMonths: 3,
  matchesPlayed: 15,
  experience: "This is a clearly marked test experience for validation only.",
  pros: "Useful test observations",
  cons: "Some test limitations",
  comfort: 5,
  fit: 4,
  traction: 3,
  ballTouch: 2,
  durability: 1,
  value: 3,
};
describe("structured review validation", () => {
  it("defaults to private foot info and retains six criteria", () => {
    const x = reviewSchema.parse(valid);
    expect(x.shareFootInfo).toBe(false);
    expect(x.footLengthCm).toBeNull();
    expect(overall(x)).toBe(3);
  });
  it.each([0, 6, 2.5, "5", null])("rejects invalid rating %s", (rating) =>
    expect(reviewSchema.safeParse({ ...valid, comfort: rating }).success).toBe(
      false,
    ),
  );
  it("requires exact variant, size system and written observations", () => {
    for (const change of [
      { variantId: "" },
      { sizeSystem: "wrong" },
      { sizeWorn: "0" },
      { experience: "short" },
      { matchesPlayed: -1 },
      { pros: "" },
    ])
      expect(reviewSchema.safeParse({ ...valid, ...change }).success).toBe(
        false,
      );
  });
  it("does not accept forged user IDs, totals or permission", () => {
    for (const extra of [
      { authorId: "forged" },
      { ratingTotal: 30 },
      { isOwner: true },
    ])
      expect(reviewSchema.safeParse({ ...valid, ...extra }).success).toBe(
        false,
      );
  });
  it("validates measurements, consent and paired price/currency", () => {
    expect(reviewSchema.safeParse({ ...valid, footLengthCm: 50 }).success).toBe(
      false,
    );
    expect(
      reviewSchema.safeParse({ ...valid, shareFootInfo: "true" }).success,
    ).toBe(false);
    expect(
      reviewSchema.safeParse({ ...valid, purchasePrice: 50 }).success,
    ).toBe(false);
    expect(
      reviewSchema.parse({
        ...valid,
        footLengthCm: 27.1,
        shareFootInfo: true,
        purchasePrice: 50.25,
        currency: "GBP",
      }).shareFootInfo,
    ).toBe(true);
  });
  it("requires optimistic version on edits", () => {
    expect(editReviewSchema.safeParse(valid).success).toBe(false);
    expect(editReviewSchema.parse({ ...valid, version: 1 }).version).toBe(1);
  });
  it("validates query bounds and desired helpful state", () => {
    expect(reviewQuery(new URLSearchParams()).sort).toBe("recent");
    expect(() => reviewQuery(new URLSearchParams("page=0"))).toThrow();
    expect(helpfulSchema.safeParse({ helpful: 1 }).success).toBe(false);
  });
});
