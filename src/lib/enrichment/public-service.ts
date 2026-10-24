import 'server-only';
import { getDb } from '@/lib/db';
import { publicAssets, publicTechnical } from './public';
export async function publicEnrichment(entryId: string) {
    return getDb().$transaction(async (tx) => {
        const entry = await tx.catalogueEntry.findFirst({ where: { id: entryId, published: true, sample: false }, select: { outsoleVariantId: true, productImages: { take: 51, orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { id: 'asc' }], include: { uploadedImage: { select: { width: true, height: true, state: true, status: true } }, source: { select: { status: true, authorizationStatus: true } } } } } });
        if (!entry)
            return { attributes: [], images: [] };
        const claims = await tx.productClaim.findMany({ where: { OR: [{ entryId }, { variantId: entry.outsoleVariantId }] }, take: 201, orderBy: { id: 'asc' }, select: { entryId: true, variantId: true, attribute: true, value: true, status: true, basis: true, sourceId: true, sourceUrl: true, observedAt: true, reviewedAt: true, source: { select: { name: true, type: true, status: true, authorizationStatus: true } } } });
        return { attributes: publicTechnical(claims, entryId, entry.outsoleVariantId), images: entry.productImages.length > 50 ? [] : publicAssets(entry.productImages) };
    }, { isolationLevel: 'RepeatableRead' });
}
