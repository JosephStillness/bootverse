import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { lockedActiveUser } from "@/lib/accounts/authorization-db";
import { AccessError, requireActiveUser, requireOwner, type Principal } from "@/lib/accounts/authorization";
import { CommunityError } from "@/lib/community/service";
import { BodyTooLargeError } from "@/lib/accounts/request";
import { processImage } from "./image-processing";
import { imageTargetSchema, type ImageTarget } from "./validation";
import { storage, uploadLimits } from "./storage";
import { uploadTarget, targetInfo } from "./targets";
export async function imageBytes(request: Request, max: number) {
    if (!request.body)
        throw new CommunityError(400, "Choose an image.");
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
        while (true) {
            const r = await reader.read();
            if (r.done)
                break;
            bytes += r.value.byteLength;
            if (bytes > max) {
                await reader.cancel();
                throw new BodyTooLargeError();
            }
            chunks.push(r.value);
        }
    }
    finally {
        reader.releaseLock();
    }
    return Buffer.concat(chunks);
}
const imageSelect = { id: true, width: true, height: true, status: true, state: true } as const;
export async function listImages(target: ImageTarget, actor: Principal | null) {
    const db = getDb();
    const info = await uploadTarget(db, target);
    const owned = actor?.status === "ACTIVE" && !!actor.emailVerified && actor.id === info.ownerId;
    if (!info.published && !owned)
        throw new CommunityError(404, "Content not found.");
    return db.uploadedImage.findMany({ where: { ...info.link, ...(owned ? {} : { status: "PUBLISHED" as const, state: "READY" as const }) }, select: imageSelect, orderBy: { createdAt: "asc" }, take: 8 });
}
export async function uploadImage(actor: Principal | null, target: ImageTarget, bytes: Buffer) {
    requireActiveUser(actor);
    const backend = storage();
    const limits = uploadLimits();
    let image;
    try {
        image = await processImage(bytes, limits.bytes);
    }
    catch {
        throw new CommunityError(400, "Choose a valid JPEG, PNG or WebP within the image limits.");
    }
    const db = getDb();
    const reservation = await db.$transaction(async (tx) => {
        // Serialize quota reservations per user without holding locks during S3 calls.
        if (actor)
            await tx.$queryRaw `SELECT id FROM "User" WHERE id=${actor.id} FOR UPDATE`;
        const user = await lockedActiveUser(tx, actor);
        const info = await uploadTarget(tx, target);
        requireOwner(user, info.ownerId);
        if (!info.published)
            throw new AccessError(403, "Hidden content cannot receive new images.");
        const [count, quota] = await Promise.all([tx.uploadedImage.count({ where: info.link }), tx.uploadedImage.aggregate({ where: { ownerId: user.id }, _count: true, _sum: { bytes: true } })]);
        if (count >= (info.limit ?? limits.quantity))
            throw new CommunityError(409, "Remove an existing image before adding another.");
        if (quota._count >= limits.ownerQuantity || (quota._sum.bytes ?? 0) + image.buffer.length > limits.ownerBytes)
            throw new CommunityError(409, "Your image storage quota has been reached.");
        return tx.uploadedImage.create({ data: { ...info.link, ownerId: user.id, slot: target.kind, objectKey: `images/${randomUUID()}.webp`, bytes: image.buffer.length, width: image.width, height: image.height }, select: { ...imageSelect, objectKey: true } });
    });
    try {
        await backend.put(reservation.objectKey, image.buffer);
        return await db.uploadedImage.update({ where: { id: reservation.id }, data: { state: "READY" }, select: imageSelect });
    }
    catch {
        // Deletion trigger retains a durable cleanup job even if S3 is temporarily unavailable.
        await db.uploadedImage.deleteMany({ where: { id: reservation.id } });
        throw Error("Image storage is unavailable.");
    }
}
export async function deleteImage(id: string, actor: Principal | null) {
    await getDb().$transaction(async (tx) => { const user = await lockedActiveUser(tx, actor); const row = await tx.uploadedImage.findUnique({ where: { id }, select: { ownerId: true } }); if (!row)
        throw new CommunityError(404, "Image not found."); requireOwner(user, row.ownerId); await tx.uploadedImage.delete({ where: { id } }); });
}
export async function readImage(id: string, actor: Principal | null) {
    const db = getDb();
    const info = await targetInfo(db, "IMAGE", id);
    if (!info.published && !(actor && actor.status === "ACTIVE" && actor.emailVerified && (actor.id === info.ownerId || actor.role !== "USER")))
        throw new CommunityError(404, "Image not found.");
    const row = await db.uploadedImage.findUnique({ where: { id }, select: { objectKey: true, state: true } });
    if (!row || row.state !== "READY")
        throw new CommunityError(404, "Image not found.");
    const bytes = await storage().get(row.objectKey);
    if (!bytes)
        throw new CommunityError(404, "Image not found.");
    return bytes;
}
export async function cleanupImages() {
    const db = getDb(), backend = storage(), cutoff = new Date(Date.now() - 60 * 60 * 1000);
    await db.uploadedImage.deleteMany({ where: { state: "UPLOADING", createdAt: { lt: cutoff } } });
    const jobs = await db.storageDeletion.findMany({ where: { createdAt: { lt: cutoff } }, take: 100, orderBy: { createdAt: "asc" } });
    let removed = 0;
    for (const job of jobs) {
        try {
            await backend.remove(job.objectKey);
            await db.storageDeletion.deleteMany({ where: { objectKey: job.objectKey } });
            removed++;
        }
        catch { /* Retain failed jobs for the next scheduled run. */ }
    }
    return { removed, remaining: await db.storageDeletion.count() };
}
export { imageTargetSchema };
