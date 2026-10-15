import "server-only";
import { publicAuthorSelect } from "@/lib/platform/public-author";
import { getDb } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { Principal } from "@/lib/accounts/authorization";
import { requireOwner } from "@/lib/accounts/authorization";
import { lockedActiveUser } from "@/lib/accounts/authorization-db";
import { CommunityError, publicWhere } from "./service";
import {
  commentSchema,
  editCommentSchema,
  voteSchema,
  commentsQuerySchema,
} from "./interactions-validation";
import { deletePostSchema } from "./validation";

async function writablePost(tx: Prisma.TransactionClient, slug: string) {
  // Serializes interaction/counter writes and prevents a post being hidden/deleted mid-write.
  const [locked] = await tx.$queryRaw<
    { id: string }[]
  >`SELECT id FROM "Post" WHERE slug=${slug} FOR UPDATE`;
  if (
    !locked ||
    !(await tx.post.findFirst({
      where: { ...publicWhere, id: locked.id },
      select: { id: true },
    }))
  )
    throw new CommunityError(404, "Post not found.");
  return locked.id;
}
export async function listComments(
  slug: string,
  input: unknown,
  actor: Principal | null,
) {
  const { parent, page } = commentsQuerySchema.parse(input);
  return getDb().$transaction(
    async (tx) => {
      const post = await tx.post.findFirst({
        where: { ...publicWhere, slug },
        select: { id: true, commentCount: true },
      });
      if (!post) throw new CommunityError(404, "Post not found.");
      if (
        parent &&
        !(await tx.comment.findFirst({
          where: { id: parent, postId: post.id },
          select: { id: true },
        }))
      )
        throw new CommunityError(404, "Comment not found.");
      const where = { postId: post.id, parentCommentId: parent };
      const total = await tx.comment.count({ where });
      const rows = await tx.comment.findMany({
        where,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 10,
        skip: (page - 1) * 10,
        select: {
          id: true,
          content: true,
          depth: true,
          version: true,
          deletedAt: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          authorId: true,
          author: {
            select: {
              status: true,
              emailVerified: true,
              profile: publicAuthorSelect.profile,
            },
          },
          _count: { select: { replies: true } },
        },
      });
      return {
        comments: rows.map((row) => {
          const visible =
            !row.deletedAt &&
            row.status === "PUBLISHED" &&
            row.author?.status === "ACTIVE" &&
            !!row.author.emailVerified &&
            !!row.author.profile;
          return {
            id: row.id,
            content: visible ? row.content : null,
            depth: row.depth,
            version: row.version,
            author: visible ? row.author!.profile : null,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
            deleted: !!row.deletedAt,
            replyCount: row._count.replies,
            canEdit:
              visible &&
              actor?.status === "ACTIVE" &&
              !!actor.emailVerified &&
              actor.id === row.authorId,
          };
        }),
        page,
        pages: Math.max(1, Math.ceil(total / 10)),
        total,
        commentCount: post.commentCount,
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
export type CommentPage = Awaited<ReturnType<typeof listComments>>;
export type CommentItem = CommentPage["comments"][number];
export async function createComment(
  slug: string,
  actor: Principal | null,
  input: unknown,
) {
  const data = commentSchema.parse(input);
  return getDb().$transaction(async (tx) => {
    const user = await lockedActiveUser(tx, actor),
      postId = await writablePost(tx, slug);
    const parent = data.parentCommentId
      ? await tx.comment.findFirst({
          where: { id: data.parentCommentId, postId },
          select: {
            depth: true,
            deletedAt: true,
          status: true,
            author: { select: { status: true, emailVerified: true } },
          },
        })
      : null;
    if (
      data.parentCommentId &&
      (!parent ||
        parent.deletedAt ||
        parent.status !== "PUBLISHED" ||
        parent.author?.status !== "ACTIVE" ||
        !parent.author.emailVerified)
    )
      throw new CommunityError(
        400,
        "Choose an available comment on this post.",
      );
    if (parent && parent.depth >= 2)
      throw new CommunityError(400, "Replies are limited to two levels.");
    const comment = await tx.comment.create({
      data: {
        postId,
        authorId: user.id,
        content: data.content,
        parentCommentId: data.parentCommentId,
        parentDepth: parent?.depth ?? null,
        depth: parent ? parent.depth + 1 : 0,
      },
      select: { id: true },
    });
    const count = await tx.comment.count({
      where: { postId, parentCommentId: data.parentCommentId },
    });
    return { ...comment, page: Math.ceil(count / 10) };
  });
}
export async function changeComment(
  slug: string,
  id: string,
  actor: Principal | null,
  input: unknown,
  deleting = false,
) {
  const data = deleting
    ? { ...deletePostSchema.parse(input), content: null, deletedAt: new Date() }
    : { ...editCommentSchema.parse(input), deletedAt: undefined };
  return getDb().$transaction(async (tx) => {
    const user = await lockedActiveUser(tx, actor),
      postId = await writablePost(tx, slug);
    const comment = await tx.comment.findFirst({
      where: { id, postId, deletedAt: null, status: "PUBLISHED" },
      select: { authorId: true },
    });
    if (!comment) throw new CommunityError(404, "Comment not found.");
    requireOwner(user, comment.authorId ?? "");
    const result = await tx.comment.updateMany({
      where: { id, version: data.version, deletedAt: null },
      data: {
        content: data.content,
        deletedAt: data.deletedAt,
        version: { increment: 1 },
      },
    });
    if (!result.count)
      throw new CommunityError(
        409,
        "This comment changed. Reload before editing.",
      );
  });
}
export async function votingState(slug: string, actor: Principal | null) {
  return getDb().$transaction(
    async (tx) => {
      const post = await tx.post.findFirst({
        where: { ...publicWhere, slug },
        select: { id: true, score: true },
      });
      if (!post) throw new CommunityError(404, "Post not found.");
      const vote =
        actor?.status === "ACTIVE" && actor.emailVerified
          ? await tx.postVote.findUnique({
              where: { postId_userId: { postId: post.id, userId: actor.id } },
              select: { value: true },
            })
          : null;
      return { score: post.score, value: (vote?.value ?? 0) as -1 | 0 | 1 };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
export async function setVote(
  slug: string,
  actor: Principal | null,
  input: unknown,
) {
  const { value } = voteSchema.parse(input);
  return getDb().$transaction(async (tx) => {
    const user = await lockedActiveUser(tx, actor),
      postId = await writablePost(tx, slug);
    if (!value)
      await tx.postVote.deleteMany({ where: { postId, userId: user.id } });
    else
      await tx.postVote.upsert({
        where: { postId_userId: { postId, userId: user.id } },
        create: { postId, userId: user.id, value },
        update: { value },
      });
    const post = await tx.post.findUniqueOrThrow({
      where: { id: postId },
      select: { score: true },
    });
    return { score: post.score, value };
  });
}
