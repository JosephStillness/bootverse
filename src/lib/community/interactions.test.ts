import { describe, expect, it } from "vitest";
import {
  commentSchema,
  editCommentSchema,
  voteSchema,
  commentsQuerySchema,
} from "./interactions-validation";
import { feedSchema } from "./validation";
describe("interaction inputs", () => {
  it("trims comments and rejects empty, oversized and control-character input", () => {
    expect(commentSchema.parse({ content: " Hello " })).toEqual({
      content: "Hello",
      parentCommentId: null,
    });
    for (const content of ["", "   ", "x".repeat(3001), "bad\u0000text"])
      expect(commentSchema.safeParse({ content }).success).toBe(false);
  });
  it("rejects claimed authors, depths, counters and moving an existing reply", () => {
    expect(
      commentSchema.safeParse({ content: "hello", authorId: "other" }).success,
    ).toBe(false);
    expect(
      commentSchema.safeParse({ content: "hello", depth: 0 }).success,
    ).toBe(false);
    expect(
      editCommentSchema.safeParse({
        content: "edit",
        version: 1,
        parentCommentId: "other",
      }).success,
    ).toBe(false);
    expect(
      editCommentSchema.safeParse({ content: "edit", version: 0 }).success,
    ).toBe(false);
  });
  it("accepts only desired voting states", () => {
    for (const value of [-1, 0, 1])
      expect(voteSchema.parse({ value })).toEqual({ value });
    for (const value of [2, -2, "1", null])
      expect(voteSchema.safeParse({ value }).success).toBe(false);
    expect(voteSchema.safeParse({ value: 1, score: 100 }).success).toBe(false);
  });
  it("bounds comment pages and supports real activity sorting", () => {
    expect(commentsQuerySchema.parse({})).toEqual({ parent: null, page: 1 });
    expect(commentsQuerySchema.safeParse({ page: 1001 }).success).toBe(false);
    expect(feedSchema.parse({ sort: "popular" }).sort).toBe("popular");
    expect(feedSchema.parse({ sort: "discussed" }).sort).toBe("discussed");
  });
});
