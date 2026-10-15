import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { lockedActiveUser } from "@/lib/accounts/authorization-db";
import { requireOwner, type Principal } from "@/lib/accounts/authorization";
import { CommunityError } from "@/lib/community/service";
import { creatorSchema, directoryQuery, videoSchema } from "./validation";
import { targetInfo } from "./targets";
const profileSelect = { username: true, displayName: true, bio: true, images: { where: { status: "PUBLISHED" as const, state: "READY" as const }, select: { id: true }, take: 1 } };
export const creatorSelect = { id: true, region: true, specialization: true, youtube: true, tiktok: true, instagram: true, website: true, verificationStatus: true, createdAt: true, images: { where: { status: "PUBLISHED" as const, state: "READY" as const }, select: { id: true }, take: 1 }, user: { select: { profile: { select: profileSelect } } } } as const;
const visible = { status: "PUBLISHED" as const, user: { status: "ACTIVE" as const, emailVerified: { not: null }, profile: { isNot: null } } };
export function verifiedCreator(creator: {
    status: string;
    verificationStatus: string;
} | null | undefined) { return creator?.status === "PUBLISHED" && creator.verificationStatus === "APPROVED"; }
export async function saveCreator(actor: Principal | null, input: unknown) {
    const data = creatorSchema.parse(input);
    return getDb().$transaction(async (tx) => {
        if (actor)
            await tx.$queryRaw `SELECT id FROM "User" WHERE id=${actor.id} FOR UPDATE`;
        const user = await lockedActiveUser(tx, actor);
        const previous = await tx.creatorProfile.findUnique({ where: { userId: user.id } });
        const linksChanged = previous && (["youtube", "tiktok", "instagram"] as const).some(k => previous[k] !== data[k]);
        if (linksChanged) {
            const requests = await tx.creatorVerificationRequest.findMany({ where: { creatorId: previous.id, status: { in: ["PENDING", "APPROVED"] } }, select: { id: true } });
            for (const request of requests) {
                await tx.creatorVerificationRequest.update({ where: { id: request.id }, data: { status: "REVOKED" } });
                await tx.creatorVerificationDecision.create({ data: { requestId: request.id, actorId: user.id, status: "REVOKED", note: "Creator changed public social links; ownership must be checked again." } });
            }
        }
        return tx.creatorProfile.upsert({ where: { userId: user.id }, create: { ...data, userId: user.id }, update: { ...data, ...(linksChanged ? { verificationStatus: "UNVERIFIED" as const } : {}) }, select: { id: true } });
    });
}
export async function ownCreator(actor: Principal | null) {
    if (!actor)
        return null;
    return getDb().creatorProfile.findUnique({ where: { userId: actor.id }, select: { ...creatorSelect, status: true, requests: { orderBy: { createdAt: "desc" }, take: 5, select: { id: true, status: true, challenge: true, createdAt: true, decisions: { orderBy: { createdAt: "desc" }, take: 5, select: { status: true, note: true, createdAt: true } } } } } });
}
export async function creators(input: unknown) {
    const q = directoryQuery.parse(input), word = q.q.replace(/[\\%_]/g, "\\$&");
    const where = { ...visible, ...(q.specialization ? { specialization: { equals: q.specialization, mode: "insensitive" as const } } : {}), ...(word ? { OR: [{ specialization: { contains: word, mode: "insensitive" as const } }, { user: { profile: { is: { OR: [{ displayName: { contains: word, mode: "insensitive" as const } }, { username: { contains: word, mode: "insensitive" as const } }] } } } }] } : {}) };
    const db = getDb();
    const [total, rows] = await db.$transaction([db.creatorProfile.count({ where }), db.creatorProfile.findMany({ where, select: creatorSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 12, skip: (q.page - 1) * 12 })], { isolationLevel: "RepeatableRead" });
    return { creators: rows, total, page: q.page, pages: Math.ceil(total / 12) };
}
export async function creatorByUsername(username: string) { return getDb().creatorProfile.findFirst({ where: { ...visible, user: { ...visible.user, profile: { is: { username } } } }, select: creatorSelect }); }
export async function requestVerification(actor: Principal | null) {
    return getDb().$transaction(async (tx) => {
        const user = await lockedActiveUser(tx, actor);
        await tx.$queryRaw `SELECT id FROM "CreatorProfile" WHERE "userId"=${user.id} FOR UPDATE`;
        const creator = await tx.creatorProfile.findUnique({ where: { userId: user.id } });
        if (!creator || creator.status !== "PUBLISHED")
            throw new CommunityError(400, "Create an available creator profile first.");
        if (!creator.youtube && !creator.tiktok && !creator.instagram)
            throw new CommunityError(400, "Add at least one public social profile URL first.");
        if (creator.verificationStatus === "APPROVED")
            throw new CommunityError(409, "Your creator account is already verified.");
        const pending = await tx.creatorVerificationRequest.findFirst({ where: { creatorId: creator.id, status: "PENDING" }, select: { id: true, challenge: true } });
        if (pending)
            return pending;
        const request = await tx.creatorVerificationRequest.create({ data: { creatorId: creator.id, challenge: `bootverse-${randomUUID()}`, youtube: creator.youtube, tiktok: creator.tiktok, instagram: creator.instagram }, select: { id: true, challenge: true } });
        await tx.creatorProfile.update({ where: { id: creator.id }, data: { verificationStatus: "PENDING" } });
        return request;
    });
}
export async function addVideo(actor: Principal | null, input: unknown) {
    const data = videoSchema.parse(input);
    return getDb().$transaction(async (tx) => {
        if (actor)
            await tx.$queryRaw `SELECT id FROM "User" WHERE id=${actor.id} FOR UPDATE`;
        const user = await lockedActiveUser(tx, actor), info = await targetInfo(tx, data.kind, data.id);
        requireOwner(user, info.ownerId);
        const creator = await tx.creatorProfile.findUnique({ where: { userId: user.id } });
        if (!info.published || !creator || creator.status !== "PUBLISHED")
            throw new CommunityError(400, "An available creator profile and your own public content are required.");
        const link = data.kind === "POST" ? { postId: data.id } : { reviewId: data.id };
        if (await tx.creatorVideo.count({ where: link }) >= 3)
            throw new CommunityError(409, "At most three videos per contribution.");
        if (await tx.creatorVideo.findFirst({ where: { ...link, videoId: data.url } }))
            throw new CommunityError(409, "This video is already linked.");
        return tx.creatorVideo.create({ data: { ...link, ownerId: user.id, videoId: data.url, title: data.title, sponsorship: data.sponsorship }, select: { id: true } });
    });
}
export async function deleteVideo(actor: Principal | null, id: string) { await getDb().$transaction(async (tx) => { const user = await lockedActiveUser(tx, actor), r = await tx.creatorVideo.findUnique({ where: { id }, select: { ownerId: true } }); if (!r)
    throw new CommunityError(404, "Video not found."); requireOwner(user, r.ownerId); await tx.creatorVideo.delete({ where: { id } }); }); }
export async function videos(kind: "POST" | "REVIEW", id: string) { const db = getDb(), info = await targetInfo(db, kind, id); if (!info.published)
    throw new CommunityError(404, "Content not found."); return db.creatorVideo.findMany({ where: { ...(kind === "POST" ? { postId: id } : { reviewId: id }), owner: { status: "ACTIVE", emailVerified: { not: null }, creator: { is: { status: "PUBLISHED" } } } }, select: { id: true, title: true, videoId: true, sponsorship: true }, orderBy: { createdAt: "asc" }, take: 3 }); }
