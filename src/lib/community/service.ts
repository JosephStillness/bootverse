import "server-only";
import { randomUUID } from "node:crypto";
import { cache } from "react";
import { lockedActiveUser } from "@/lib/accounts/authorization-db";
import { getDb } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import {
  requireActiveUser,
  type Principal,
} from "@/lib/accounts/authorization";
import { canManagePost, requirePostManager } from "./authorization";
import {
  postSchema,
  editPostSchema,
  deletePostSchema,
  postExcerpt,
  type FeedFilters,
} from "./validation";

export class CommunityError extends Error {
  constructor(
    public status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}
const bootSelect = {
  id: true,
  slug: true,
  sample: true,
  colorway: { select: { name: true } },
  variant: {
    select: {
      surface: true,
      tier: {
        select: {
          name: true,
          generation: {
            select: {
              name: true,
              family: {
                select: { name: true, brand: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CatalogueEntrySelect;
type BootRow = Prisma.CatalogueEntryGetPayload<{ select: typeof bootSelect }>;
export function bootReference(boot: BootRow) {
  const tier = boot.variant.tier,
    generation = tier.generation;
  return {
    id: boot.id,
    slug: boot.slug,
    sample: boot.sample,
    label: `${generation.family.brand.name} ${generation.family.name} · ${generation.name} · ${tier.name} · ${boot.variant.surface ?? "Unknown surface"} · ${boot.colorway.name}`,
  };
}
export type BootReference = ReturnType<typeof bootReference>;
export async function catalogueReferences() {
  const rows = await getDb().catalogueEntry.findMany({
    select: bootSelect,
    orderBy: { slug: "asc" },
  });
  return rows.map(bootReference);
}
const postSelect = {
  id: true,
  slug: true,
  title: true,
  content: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
  author: {
    select: { profile: { select: { username: true, displayName: true } } },
  },
  tags: {
    select: { tag: { select: { name: true } } },
    orderBy: { tagId: "asc" },
  },
  boot: { select: bootSelect },
} satisfies Prisma.PostSelect;
type PostRow = Prisma.PostGetPayload<{ select: typeof postSelect }>;
function postDTO(post: PostRow) {
  return {
    ...post,
    author: post.author.profile!,
    tags: post.tags.map((row) => row.tag.name),
    boot: post.boot ? bootReference(post.boot) : null,
    excerpt: postExcerpt(post.content),
  };
}
export type CommunityPost = ReturnType<typeof postDTO>;
const publicWhere = {
  status: "PUBLISHED",
  author: {
    status: "ACTIVE",
    emailVerified: { not: null },
    profile: { isNot: null },
  },
} satisfies Prisma.PostWhereInput;
export const pageSize = 10;
export async function listPosts(filters: FeedFilters) {
  const where: Prisma.PostWhereInput = {
    ...publicWhere,
    ...(filters.category && { categoryId: filters.category }),
    ...(filters.boot && { bootEntryId: filters.boot }),
    ...(filters.tag && { tags: { some: { tagId: filters.tag } } }),
    ...(filters.author && {
      author: {
        ...publicWhere.author,
        profile: { is: { username: filters.author } },
      },
    }),
    AND: filters.q
      .split(/\s+/)
      .filter(Boolean)
      // Prisma contains uses SQL LIKE patterns; punctuation must stay literal.
      .map((word) => word.replace(/[\\%_]/g, "\\$&"))
      .map((word) => ({
        OR: [
          { title: { contains: word, mode: "insensitive" } },
          { content: { contains: word, mode: "insensitive" } },
          {
            tags: { some: { tagId: { contains: word, mode: "insensitive" } } },
          },
        ],
      })),
  };
  const direction = filters.sort === "oldest" ? "asc" : "desc";
  const [total, rows] = await getDb().$transaction(
    [
      getDb().post.count({ where }),
      getDb().post.findMany({
        where,
        select: postSelect,
        orderBy: [{ createdAt: direction }, { id: direction }],
        take: pageSize,
        skip: (filters.page - 1) * pageSize,
      }),
    ],
    { isolationLevel: "RepeatableRead" },
  );
  return {
    posts: rows.map((row) => {
      const dto = postDTO(row);
      const {
        id,
        slug,
        title,
        version,
        createdAt,
        updatedAt,
        category,
        author,
        tags,
        boot,
        excerpt,
      } = dto;
      return {
        id,
        slug,
        title,
        version,
        createdAt,
        updatedAt,
        category,
        author,
        tags,
        boot,
        excerpt,
      };
    }),
    total,
    page: filters.page,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
export const publicPost = cache(async (slug: string) => {
  const post = await getDb().post.findFirst({
    where: { ...publicWhere, slug },
    select: postSelect,
  });
  return post ? postDTO(post) : null;
});
export async function editablePost(slug: string, actor: Principal | null) {
  requireActiveUser(actor);
  const post = await getDb().post.findUnique({
    where: { slug },
    select: { ...postSelect, authorId: true, status: true },
  });
  if (!post) throw new CommunityError(404, "Post not found.");
  requirePostManager(actor, post.authorId);
  return { post: postDTO(post), status: post.status };
}
export async function postPermissions(slug: string, actor: Principal | null) {
  if (!actor) return false;
  const post = await getDb().post.findUnique({
    where: { slug },
    select: { authorId: true },
  });
  if (!post) return false;
  return canManagePost(actor, post.authorId);
}
async function validateBoot(
  tx: Prisma.TransactionClient,
  bootEntryId: string | null,
) {
  if (
    bootEntryId &&
    !(await tx.catalogueEntry.findUnique({
      where: { id: bootEntryId },
      select: { id: true },
    }))
  )
    throw new CommunityError(400, "Choose an existing catalogue boot.");
}
async function tagLinks(tx: Prisma.TransactionClient, tags: string[]) {
  if (tags.length)
    await tx.tag.createMany({
      data: tags.map((name) => ({ name })),
      skipDuplicates: true,
    });
  return tags.map((tagId) => ({ tagId }));
}
export async function createPost(actor: Principal | null, input: unknown) {
  requireActiveUser(actor);
  const data = postSchema.parse(input);
  const slug = `${
    data.title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70)
      .replace(/-$/, "") || "discussion"
  }-${randomUUID().replaceAll("-", "")}`;
  return getDb().$transaction(async (tx) => {
    const author = await lockedActiveUser(tx, actor);
    await validateBoot(tx, data.bootEntryId);
    const { tags, ...fields } = data;
    return tx.post.create({
      data: {
        ...fields,
        slug,
        authorId: author.id,
        tags: { create: await tagLinks(tx, tags) },
      },
      select: { slug: true },
    });
  });
}
export async function editPost(
  slug: string,
  actor: Principal | null,
  input: unknown,
) {
  requireActiveUser(actor);
  const data = editPostSchema.parse(input);
  return getDb().$transaction(async (tx) => {
    const current = await lockedActiveUser(tx, actor);
    const post = await tx.post.findUnique({
      where: { slug },
      select: { id: true, authorId: true },
    });
    if (!post) throw new CommunityError(404, "Post not found.");
    requirePostManager(current, post.authorId);
    await validateBoot(tx, data.bootEntryId);
    const { tags, version, ...fields } = data;
    const updated = await tx.post.updateMany({
      where: { id: post.id, version },
      data: { ...fields, version: { increment: 1 } },
    });
    if (!updated.count)
      throw new CommunityError(
        409,
        "This post changed in another tab. Reload before editing.",
      );
    await tx.postTag.deleteMany({ where: { postId: post.id } });
    await tx.post.update({
      where: { id: post.id },
      data: { tags: { create: await tagLinks(tx, tags) } },
    });
    return { slug };
  });
}
export async function deletePost(
  slug: string,
  actor: Principal | null,
  input: unknown,
) {
  requireActiveUser(actor);
  const { version } = deletePostSchema.parse(input);
  return getDb().$transaction(async (tx) => {
    const current = await lockedActiveUser(tx, actor);
    const post = await tx.post.findUnique({
      where: { slug },
      select: { id: true, authorId: true },
    });
    if (!post) throw new CommunityError(404, "Post not found.");
    requirePostManager(current, post.authorId);
    const removed = await tx.post.deleteMany({
      where: { id: post.id, version },
    });
    if (!removed.count)
      throw new CommunityError(
        409,
        "This post changed in another tab. Reload before deleting.",
      );
  });
}
