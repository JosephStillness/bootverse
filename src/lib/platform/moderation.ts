import "server-only";
import { getDb } from "@/lib/db";
import { lockedActiveUser } from "@/lib/accounts/authorization-db";
import { AccessError, requireModerator, type Principal } from "@/lib/accounts/authorization";
import { CommunityError } from "@/lib/community/service";
import { reportSchema, moderationSchema, verificationDecisionSchema, adminQuery, type TargetKind } from "./validation";
import { targetInfo } from "./targets";
export async function reportContent(actor: Principal | null, input: unknown) {
    const data = reportSchema.parse(input);
    return getDb().$transaction(async (tx) => {
        const user = await lockedActiveUser(tx, actor), target = await targetInfo(tx, data.kind, data.id);
        if (!target.published)
            throw new CommunityError(404, "Content not found.");
        const targetKey = `${data.kind}:${data.id}`;
        const previous = await tx.contentReport.findUnique({ where: { reporterId_targetKey: { reporterId: user.id, targetKey } }, select: { id: true } });
        if (previous)
            return { ...previous, duplicate: true };
        const links = { POST: { postId: data.id }, COMMENT: { commentId: data.id }, REVIEW: { reviewId: data.id }, IMAGE: { imageId: data.id }, CREATOR: { creatorId: data.id } };
        const row = await tx.contentReport.upsert({ where: { reporterId_targetKey: { reporterId: user.id, targetKey } }, create: { ...links[data.kind], reporterId: user.id, targetKey, reason: data.reason, explanation: data.explanation }, update: {}, select: { id: true } });
        return { ...row, duplicate: false };
    });
}
export async function moderate(actor: Principal | null, id: string, input: unknown) {
    const data = moderationSchema.parse(input);
    return getDb().$transaction(async (tx) => {
        const user = requireModerator(await lockedActiveUser(tx, actor));
        await tx.$queryRaw `SELECT id FROM "ContentReport" WHERE id=${id} FOR UPDATE`;
        const report = await tx.contentReport.findUnique({ where: { id } });
        if (!report)
            throw new CommunityError(404, "Report not found.");
        const [kind, targetId] = report.targetKey.split(":") as [
            TargetKind,
            string
        ];
        await targetInfo(tx, kind, targetId);
        if (data.action !== "DISMISS") {
            const status = data.action === "HIDE" ? "HIDDEN" : "PUBLISHED";
            if (kind === "POST")
                await tx.post.update({ where: { id: targetId }, data: { status, version: { increment: 1 } } });
            if (kind === "COMMENT")
                await tx.comment.update({ where: { id: targetId }, data: { status, version: { increment: 1 } } });
            if (kind === "REVIEW")
                await tx.bootReview.update({ where: { id: targetId }, data: { status, version: { increment: 1 } } });
            if (kind === "IMAGE")
                await tx.uploadedImage.update({ where: { id: targetId }, data: { status } });
            if (kind === "CREATOR")
                await tx.creatorProfile.update({ where: { id: targetId }, data: { status } });
        }
        await tx.contentReport.update({ where: { id }, data: { status: data.action === "DISMISS" ? "DISMISSED" : "ACTIONED" } });
        await tx.moderationAction.create({ data: { actorId: user.id, reportId: id, targetKey: report.targetKey, ...data } });
        return { saved: true };
    });
}
export async function decideVerification(actor: Principal | null, id: string, input: unknown) {
    const data = verificationDecisionSchema.parse(input);
    return getDb().$transaction(async (tx) => {
        const user = await lockedActiveUser(tx, actor);
        if (user.role !== "ADMIN")
            throw new AccessError(403, "Administrator access is required.");
        const initial = await tx.creatorVerificationRequest.findUnique({ where: { id }, select: { creatorId: true } });
        if (!initial)
            throw new CommunityError(404, "Request not found.");
        await tx.$queryRaw `SELECT id FROM "CreatorProfile" WHERE id=${initial.creatorId} FOR UPDATE`;
        const request = await tx.creatorVerificationRequest.findUnique({ where: { id }, include: { creator: true } });
        if (!request || request.status !== "PENDING" || request.creator.status !== "PUBLISHED")
            throw new CommunityError(409, "This verification request is no longer pending.");
        if (data.status === "APPROVED" && ![request.youtube, request.tiktok, request.instagram].includes(data.proofUrl))
            throw new CommunityError(400, "Proof URL must match a submitted social profile. Check the displayed challenge there.");
        if (data.status === "APPROVED" && (["youtube", "tiktok", "instagram"] as const).some(k => request[k] !== request.creator[k]))
            throw new CommunityError(409, "Creator links changed. A new application is required.");
        await tx.creatorVerificationRequest.update({ where: { id }, data: { status: data.status } });
        await tx.creatorProfile.update({ where: { id: request.creatorId }, data: { verificationStatus: data.status } });
        await tx.creatorVerificationDecision.create({ data: { requestId: id, actorId: user.id, status: data.status, note: data.note, proofUrl: data.proofUrl } });
        return { saved: true };
    });
}
export async function adminData(actor: Principal | null, input: unknown) {
    const user = requireModerator(actor), q = adminQuery.parse(input), db = getDb();
    const where = { ...(q.status !== "ALL" ? { status: q.status } : {}), ...(q.kind ? { targetKey: { startsWith: q.kind + ":" } } : {}), ...(q.q ? { OR: [{ explanation: { contains: q.q.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" as const } }, { reason: { equals: q.q } }] } : {}) };
    const [total, reports, history, verification, verificationTotal, auditTotal, verificationHistory, verificationAuditTotal, posts, comments, reviews, creators, images, cleanup] = await Promise.all([
        db.contentReport.count({ where }), db.contentReport.findMany({ where, select: { id: true, targetKey: true, reason: true, explanation: true, status: true, createdAt: true, post: { select: { title: true, content: true, slug: true, images: { select: { id: true }, take: 8 } } }, comment: { select: { content: true } }, review: { select: { experience: true, pros: true, cons: true, images: { select: { id: true }, take: 8 } } }, creator: { select: { specialization: true, user: { select: { profile: { select: { displayName: true, bio: true } } } }, images: { select: { id: true }, take: 1 } } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 10, skip: (q.page - 1) * 10 }),
        db.moderationAction.findMany({ select: { id: true, targetKey: true, action: true, note: true, createdAt: true, actor: { select: { profile: { select: { username: true } } } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 10, skip: (q.page - 1) * 10 }),
        user.role === "ADMIN" ? db.creatorVerificationRequest.findMany({ where: { status: "PENDING" }, select: { id: true, challenge: true, youtube: true, tiktok: true, instagram: true, createdAt: true, creator: { select: { user: { select: { profile: { select: { username: true, displayName: true } } } } } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 10, skip: (q.page - 1) * 10 }) : [],
        user.role === "ADMIN" ? db.creatorVerificationRequest.count({ where: { status: "PENDING" } }) : 0, db.moderationAction.count(),
        user.role === "ADMIN" ? db.creatorVerificationDecision.findMany({select:{id:true,status:true,note:true,proofUrl:true,createdAt:true,request:{select:{creator:{select:{user:{select:{profile:{select:{username:true}}}}}}}}},orderBy:[{createdAt:"desc"},{id:"desc"}],take:10,skip:(q.page-1)*10}) : [],
        user.role === "ADMIN" ? db.creatorVerificationDecision.count() : 0,
        db.post.count(), db.comment.count(), db.bootReview.count(), db.creatorProfile.count(), db.uploadedImage.count(), db.storageDeletion.count(),
    ]);
    return { reports, total, pages: Math.ceil(total / 10), history, auditPages: Math.max(Math.ceil(auditTotal / 10),Math.ceil(verificationAuditTotal/10)), verificationHistory, verification, verificationPages: Math.ceil(verificationTotal / 10), page: q.page, overview: { posts, comments, reviews, creators, images, cleanup } };
}
