import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { TargetKind, ImageTarget } from "./validation";
import { CommunityError } from "@/lib/community/service";
export type Db = Prisma.TransactionClient;
const userSelect = { status: true, emailVerified: true } as const;
const active = (u: {
    status: string;
    emailVerified: Date | null;
} | null) => u?.status === "ACTIVE" && !!u.emailVerified;
export async function targetInfo(db: Db, kind: TargetKind, id: string) {
    if (kind === "POST") {
        const r = await db.post.findUnique({ where: { id }, select: { authorId: true, title: true, content: true, status: true, slug: true, author: { select: userSelect } } });
        if (r)
            return { ownerId: r.authorId, published: r.status === "PUBLISHED" && active(r.author), label: r.title, excerpt: r.content.slice(0, 1000), href: `/community/${r.slug}` };
    }
    else if (kind === "REVIEW") {
        const r = await db.bootReview.findUnique({ where: { id }, select: { authorId: true, status: true, experience: true, variant:{select:{entries:{where:{published:true},take:1,select:{id:true}}}}, author: { select: userSelect } } });
        if (r)
            return { ownerId: r.authorId, published: r.status === "PUBLISHED" && active(r.author) && r.variant.entries.length>0, label: "Boot review", excerpt: r.experience.slice(0, 1000), href: `/reviews/${id}` };
    }
    else if (kind === "COMMENT") {
        const r = await db.comment.findUnique({ where: { id }, select: { authorId: true, status: true, deletedAt: true, content: true, author: { select: userSelect }, post: { select: { slug: true, status: true, author: { select: userSelect } } } } });
        if (r)
            return { ownerId: r.authorId ?? "", published: !r.deletedAt && r.status === "PUBLISHED" && active(r.author) && r.post.status === "PUBLISHED" && active(r.post.author), label: "Comment", excerpt: r.content?.slice(0, 1000) ?? "Removed comment", href: `/community/${r.post.slug}#comments` };
    }
    else if (kind === "CREATOR") {
        const r = await db.creatorProfile.findUnique({ where: { id }, select: { userId: true, status: true, specialization: true, user: { select: { ...userSelect, profile: { select: { username: true, displayName: true } } } } } });
        if (r)
            return { ownerId: r.userId, published: r.status === "PUBLISHED" && active(r.user), label: r.user.profile?.displayName ?? "Creator", excerpt: r.specialization, href: `/creators/${r.user.profile?.username}` };
    }
    else {
        const r = await db.uploadedImage.findUnique({ where: { id }, select: { ownerId: true, state: true, status: true } });
        if (r) {
            const parent = await imageParent(db, id);
            return { ownerId: r.ownerId, published: r.status === "PUBLISHED" && r.state === "READY" && parent.published, label: "Uploaded image", excerpt: "Re-encoded image; original metadata removed.", href: `/api/images/${id}` };
        }
    }
    throw new CommunityError(404, "Content not found.");
}
export async function imageParent(db: Db, id: string): Promise<{
    ownerId: string;
    published: boolean;
}> {
    const r = await db.uploadedImage.findUnique({ where: { id }, select: { postId: true, reviewId: true, creatorId: true, productEntryId: true, ownerId:true, profile: { select: { userId: true, user: { select: userSelect } } } } });
    if (!r)
        throw new CommunityError(404, "Image not found.");
    if(r.productEntryId){
        const photo=await db.productImage.findFirst({where:{uploadedImageId:id,entryId:r.productEntryId,status:"VERIFIED",licenseStatus:"GRANTED",reviewedAt:{not:null},entry:{published:true},source:{status:"ACTIVE",authorizationStatus:{in:["GRANTED","NOT_REQUIRED"]}}},select:{id:true}});
        return {ownerId:r.ownerId,published:!!photo};
    }
    if (r.postId)
        return targetInfo(db, "POST", r.postId);
    if (r.reviewId)
        return targetInfo(db, "REVIEW", r.reviewId);
    if (r.creatorId)
        return targetInfo(db, "CREATOR", r.creatorId);
    return { ownerId: r.profile?.userId ?? "", published: active(r.profile?.user ?? null) };
}
export async function uploadTarget(db: Db, target: ImageTarget) {
    if(target.kind === "PRODUCT"){
        const entry=await db.catalogueEntry.findUnique({where:{id:target.id},select:{id:true}});
        if(!entry)throw new CommunityError(404,"Product not found.");
        return {ownerId:"",published:true,link:{productEntryId:target.id},limit:8};
    }
    if (target.kind === "AVATAR") {
        const p = await db.userProfile.findUnique({ where: { id: target.id }, select: { userId: true, user: { select: userSelect } } });
        if (!p)
            throw new CommunityError(404, "Profile not found.");
        return { ownerId: p.userId, published: active(p.user), link: { profileId: target.id }, limit: 1 };
    }
    const kind = target.kind === "COVER" ? "CREATOR" : target.kind;
    const info = await targetInfo(db, kind, target.id);
    return { ...info, link: target.kind === "POST" ? { postId: target.id } : target.kind === "REVIEW" ? { reviewId: target.id } : { creatorId: target.id }, limit: target.kind === "COVER" ? 1 : null };
}
