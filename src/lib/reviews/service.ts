import "server-only";
import { publicAuthorSelect, authorDTO } from "@/lib/platform/public-author";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { AccessError, type Principal } from "@/lib/accounts/authorization";
import { lockedActiveUser } from "@/lib/accounts/authorization-db";
import { CommunityError } from "@/lib/community/service";
import { deletePostSchema } from "@/lib/community/validation";
import {
  criteria,
  reviewSchema,
  editReviewSchema,
  helpfulSchema,
  ratingTotal,
  type ReviewQuery,
  type ReviewInput,
  type Criterion,
} from "./validation";
const visible = {
  status: "PUBLISHED",
  author: {
    status: "ACTIVE",
    emailVerified: { not: null },
    profile: { isNot: null },
  },
} satisfies Prisma.BootReviewWhereInput;
const select = {
  id: true,
  variantId: true,
  version: true,
  sizeWorn: true,
  sizeSystem: true,
  ownershipMonths: true,
  matchesPlayed: true,
  experience: true,
  sponsorship: true,
  pros: true,
  cons: true,
  comfort: true,
  fit: true,
  traction: true,
  ballTouch: true,
  durability: true,
  value: true,
  ratingTotal: true,
  shareFootInfo: true,
  position: true,
  playingSurface: true,
  widthObservation: true,
  toeRoom: true,
  midfootPressure: true,
  heelLockdown: true,
  breakIn: true,
  sizingAdvice: true,
  purchasePrice: true,
  currency: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: publicAuthorSelect,
  },
  variant: {
    select: {
      entries: {
        select: { slug: true, sample: true },
        orderBy: { slug: "asc" },
        take: 1,
      },
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
  _count: { select: { helpfulVotes: true } },
} satisfies Prisma.BootReviewSelect;
type Row = Prisma.BootReviewGetPayload<{ select: typeof select }>;
function dto(
  row: Row,
  foot: {
    footLengthCm: number | null;
    footWidthCm: number | null;
    footShape: string | null;
  } | null,
) {
  const {
    variant,
    author,
    _count,
    purchasePrice,
    ratingTotal: total,
    ...publicFields
  } = row;
  const tier = variant.tier,
    generation = tier.generation;
  return {
    ...publicFields,
    purchasePrice: purchasePrice === null ? null : Number(purchasePrice),
    author: authorDTO(author),
    boot: {
      label: `${generation.family.brand.name} ${generation.family.name} · ${generation.name} · ${tier.name} · ${variant.surface ?? "Unknown surface"}`,
      slug: variant.entries[0]?.slug ?? null,
      sample: variant.entries[0]?.sample ?? true,
    },
    overall: total / 6,
    helpfulCount: _count.helpfulVotes,
    foot,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
export type PublicReview = ReturnType<typeof dto>;
type Tx = Prisma.TransactionClient;
// Private fields are fetched only for consenting reviews, never included in the base public projection.
async function publicRows(tx: Tx, rows: Row[]) {
  const shared = await tx.bootReview.findMany({
    where: {
      id: { in: rows.filter((row) => row.shareFootInfo).map((row) => row.id) },
      shareFootInfo: true,
    },
    select: {
      id: true,
      footLengthCm: true,
      footWidthCm: true,
      footShape: true,
    },
  });
  return rows.map((row) => {
    const foot = shared.find((x) => x.id === row.id);
    return dto(
      row,
      foot
        ? {
            footLengthCm:
              foot.footLengthCm === null ? null : Number(foot.footLengthCm),
            footWidthCm:
              foot.footWidthCm === null ? null : Number(foot.footWidthCm),
            footShape: foot.footShape,
          }
        : null,
    );
  });
}
export async function listReviews(q: ReviewQuery) {
  const where: Prisma.BootReviewWhereInput = {
    ...visible,
    ...(q.variant && { variantId: q.variant }),
    ...(q.author && {
      author: { ...visible.author, profile: { is: { username: q.author } } },
    }),
    ...(q.size && { sizeWorn: q.size }),
    ...(q.system && { sizeSystem: q.system }),
    ...(q.shape && { shareFootInfo: true, footShape: q.shape }),
    ...(q.surface && { playingSurface: q.surface }),
    ...(q.duration && {
      ownershipMonths:
        q.duration === "under-3"
          ? { lt: 3 }
          : q.duration === "3-12"
            ? { gte: 3, lte: 12 }
            : { gt: 12 },
    }),
  };
  return getDb().$transaction(
    async (tx) => {
      const total = await tx.bootReview.count({ where });
      const rows = await tx.bootReview.findMany({
        where,
        select,
        take: 10,
        skip: (q.page - 1) * 10,
        orderBy: [
          ...(q.sort === "highest" || q.sort === "lowest"
            ? [
                {
                  ratingTotal:
                    q.sort === "highest" ? ("desc" as const) : ("asc" as const),
                },
              ]
            : q.sort === "helpful"
              ? [{ helpfulVotes: { _count: "desc" as const } }]
              : []),
          { createdAt: "desc" },
          { id: "desc" },
        ],
      });
      return {
        reviews: await publicRows(tx, rows),
        total,
        page: q.page,
        pages: Math.ceil(total / 10),
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
export async function reviewSummary(variantId: string) {
  return getDb().$transaction(
    async (tx) => {
      if (
        !(await tx.bootVariant.findUnique({
          where: { id: variantId },
          select: { id: true },
        }))
      )
        throw new CommunityError(404, "Boot variant not found.");
      const where = { ...visible, variantId };
      const aggregate = await tx.bootReview.aggregate({
        where,
        _count: true,
        _avg: {
          comfort: true,
          fit: true,
          traction: true,
          ballTouch: true,
          durability: true,
          value: true,
          ratingTotal: true,
        },
      });
      const groups = await tx.bootReview.groupBy({
        by: ["ratingTotal"],
        where,
        _count: true,
      });
      const distribution = [1, 2, 3, 4, 5].map((star) => ({
        star,
        count: groups
          .filter((g) => Math.round(g.ratingTotal / 6) === star)
          .reduce((n, g) => n + g._count, 0),
      }));
      const options = await tx.bootReview.findMany({
        where,
        select: {
          sizeWorn: true,
          sizeSystem: true,
          playingSurface: true,
          ownershipMonths: true,
        },
        distinct: [
          "sizeWorn",
          "sizeSystem",
          "playingSurface",
          "ownershipMonths",
        ],
      });
      const shapes = await tx.bootReview.findMany({
        where: { ...where, shareFootInfo: true, footShape: { not: null } },
        select: { footShape: true },
        distinct: ["footShape"],
      });
      return {
        count: aggregate._count,
        overall:
          aggregate._avg.ratingTotal === null
            ? null
            : aggregate._avg.ratingTotal / 6,
        criteria: Object.fromEntries(
          Object.keys(criteria).map((key) => [
            key,
            aggregate._avg[key as Criterion],
          ]),
        ) as Record<Criterion, number | null>,
        distribution,
        options: {
          sizes: [
            ...new Set(options.map((o) => `${o.sizeSystem}:${o.sizeWorn}`)),
          ].sort(),
          shapes: shapes.map((x) => x.footShape!),
          surfaces: [
            ...new Set(
              options
                .map((o) => o.playingSurface)
                .filter((x): x is string => x !== null),
            ),
          ].sort(),
          durations: [
            ...new Set(
              options.map((o) =>
                o.ownershipMonths < 3
                  ? "under-3"
                  : o.ownershipMonths <= 12
                    ? "3-12"
                    : "over-12",
              ),
            ),
          ],
        },
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
export type ReviewSummary = Awaited<ReturnType<typeof reviewSummary>>;
export async function publicReview(id: string) {
  return getDb().$transaction(
    async (tx) => {
      const row = await tx.bootReview.findFirst({
        where: { ...visible, id },
        select,
      });
      if (!row) throw new CommunityError(404, "Review not found.");
      return (await publicRows(tx, [row]))[0];
    },
    { isolationLevel: "RepeatableRead" },
  );
}
async function lockedReview(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "BootReview" WHERE id=${id} FOR UPDATE`;
  const row = await tx.bootReview.findUnique({ where: { id } });
  if (!row) throw new CommunityError(404, "Review not found.");
  return row;
}
function owner(actor: Principal, authorId: string) {
  if (actor.id !== authorId)
    throw new AccessError(403, "You can only manage your own review.");
}
export async function ownedReview(id: string, actor: Principal | null) {
  return getDb().$transaction(async (tx) => {
    const user = await lockedActiveUser(tx, actor),
      row = await lockedReview(tx, id);
    owner(user, row.authorId);
    // This owner-only API is always no-store; explicitly project input fields.
    const input: ReviewInput = reviewSchema.parse({
      ...Object.fromEntries(
        Object.keys(reviewSchema.shape).map((key) => [
          key,
          row[key as keyof typeof row],
        ]),
      ),
      footLengthCm: row.footLengthCm === null ? null : Number(row.footLengthCm),
      footWidthCm: row.footWidthCm === null ? null : Number(row.footWidthCm),
      purchasePrice:
        row.purchasePrice === null ? null : Number(row.purchasePrice),
    });
    return { input, version: row.version };
  });
}
export async function createReview(actor: Principal | null, input: unknown) {
  const data = reviewSchema.parse(input);
  try {
    return await getDb().$transaction(async (tx) => {
      const user = await lockedActiveUser(tx, actor);
      if (
        !(await tx.bootVariant.findUnique({
          where: { id: data.variantId },
          select: { id: true },
        }))
      )
        throw new CommunityError(400, "Choose an existing boot variant.");
      const row = await tx.bootReview.create({
        data: { ...data, authorId: user.id, ratingTotal: ratingTotal(data) },
        select: { id: true },
      });
      return row;
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    )
      throw new CommunityError(
        409,
        "You already reviewed this exact variant. Edit your existing review from your profile.",
      );
    throw error;
  }
}
export async function editReview(
  id: string,
  actor: Principal | null,
  input: unknown,
) {
  const { version, ...data } = editReviewSchema.parse(input);
  return getDb().$transaction(async (tx) => {
    const user = await lockedActiveUser(tx, actor),
      row = await lockedReview(tx, id);
    owner(user, row.authorId);
    if (row.status !== "PUBLISHED")
      throw new CommunityError(409, "This review is unavailable for editing.");
    if (row.version !== version)
      throw new CommunityError(
        409,
        "This review changed. Reload before editing.",
      );
    if (row.variantId !== data.variantId)
      throw new CommunityError(400, "A review cannot move to another variant.");
    return tx.bootReview.update({
      where: { id },
      data: {
        ...data,
        ratingTotal: ratingTotal(data),
        version: { increment: 1 },
      },
      select: { id: true },
    });
  });
}
export async function deleteReview(
  id: string,
  actor: Principal | null,
  input: unknown,
) {
  const { version } = deletePostSchema.parse(input);
  return getDb().$transaction(async (tx) => {
    const user = await lockedActiveUser(tx, actor),
      row = await lockedReview(tx, id);
    owner(user, row.authorId);
    if (row.version !== version)
      throw new CommunityError(
        409,
        "This review changed. Reload before deleting.",
      );
    await tx.bootReview.delete({ where: { id } });
  });
}
export async function helpfulState(id: string, actor: Principal | null) {
  await publicReview(id);
  if (!actor || actor.status !== "ACTIVE" || !actor.emailVerified)
    return { helpful: false, canVote: false };
  const row = await getDb().bootReview.findUnique({
    where: { id },
    select: { authorId: true },
  });
  return {
    helpful: !!(await getDb().reviewHelpfulVote.findUnique({
      where: { reviewId_userId: { reviewId: id, userId: actor.id } },
    })),
    canVote: row?.authorId !== actor.id,
  };
}
export async function setHelpful(
  id: string,
  actor: Principal | null,
  input: unknown,
) {
  const { helpful } = helpfulSchema.parse(input);
  return getDb().$transaction(async (tx) => {
    const user = await lockedActiveUser(tx, actor),
      row = await lockedReview(tx, id);
    if (
      !(await tx.bootReview.findFirst({
        where: { ...visible, id },
        select: { id: true },
      }))
    )
      throw new CommunityError(404, "Review not found.");
    if (row.authorId === user.id)
      throw new AccessError(403, "You cannot mark your own review helpful.");
    const where = { reviewId_userId: { reviewId: id, userId: user.id } };
    if (helpful)
      await tx.reviewHelpfulVote.upsert({
        where,
        create: { reviewId: id, userId: user.id },
        update: {},
      });
    else
      await tx.reviewHelpfulVote.deleteMany({
        where: { reviewId: id, userId: user.id },
      });
    return {
      helpful,
      count: await tx.reviewHelpfulVote.count({ where: { reviewId: id } }),
    };
  });
}
