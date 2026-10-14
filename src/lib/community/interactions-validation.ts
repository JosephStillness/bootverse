import { z } from "zod";
import { text } from "./validation";
export const commentSchema = z
  .object({
    content: text(1, 3000),
    parentCommentId: z.string().min(1).max(100).nullable().default(null),
  })
  .strict();
export const editCommentSchema = z
  .object({
    content: text(1, 3000),
    version: z.number().int().min(1).max(2147483646),
  })
  .strict();
export const voteSchema = z
  .object({ value: z.union([z.literal(-1), z.literal(0), z.literal(1)]) })
  .strict();
export const commentsQuerySchema = z.object({
  parent: z.string().min(1).max(100).nullable().default(null),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
