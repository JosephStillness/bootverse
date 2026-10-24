import { publicSourceUrl, claimSchema } from '@/lib/product-data/validation';
import { compareClaims, isExplicitUnknown } from './observations';
import type { SourcedClaim } from '@/lib/product-data/projection';
type Asset = {
    id: string;
    status: string;
    licenseStatus: string;
    reviewedAt: Date | null;
    permissionNotes: string | null;
    permissionUrl: string | null;
    source: {
        status: string;
        authorizationStatus: string;
    };
    sortOrder: number;
    isPrimary: boolean;
    externalUrl: string | null;
    uploadedImageId: string | null;
    uploadedImage: {
        width: number;
        height: number;
        state: string;
        status: string;
    } | null;
    altText: string;
    attribution: string;
    sourceUrl: string;
};
export function publicAssets(rows: Asset[]) {
    return rows.filter(i => i.status === 'VERIFIED' && i.reviewedAt && i.licenseStatus === 'GRANTED' && i.permissionNotes && i.permissionUrl && publicSourceUrl.safeParse(i.permissionUrl).success && publicSourceUrl.safeParse(i.sourceUrl).success && i.source.status === 'ACTIVE' && ['GRANTED', 'NOT_REQUIRED'].includes(i.source.authorizationStatus) && (i.uploadedImageId ? i.uploadedImage?.state === 'READY' && i.uploadedImage.status === 'PUBLISHED' : i.externalUrl && publicSourceUrl.safeParse(i.externalUrl).success)).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)).map(i => ({ id: i.id, src: i.uploadedImageId ? `/api/images/${i.uploadedImageId}` : null, externalUrl: i.externalUrl, altText: i.altText, attribution: i.attribution, sourceUrl: i.sourceUrl, width: i.uploadedImage?.width ?? null, height: i.uploadedImage?.height ?? null }));
}
export function publicTechnical(rows: SourcedClaim[], entryId: string, variantId: string) {
    const result: {
        attribute: string;
        value: string;
        sourceUrl: string;
        sourceName: string;
        sourceType: string;
        basis: string;
        observedAt: string;
        reviewedAt: string;
    }[] = [];
    if (rows.length > 200)
        return result;
    const relevant = rows.filter(r => r.entryId === entryId || r.variantId === variantId);
    for (const attribute of new Set(relevant.map(c => c.attribute))) {
        const group = relevant.filter(c => c.attribute === attribute);
        if (group.some(c => c.status === 'CONFLICTED'))
            continue;
        const verified = group.filter(c => c.status === 'VERIFIED' && c.reviewedAt && c.source.status === 'ACTIVE' && ['GRANTED', 'NOT_REQUIRED'].includes(c.source.authorizationStatus) && !isExplicitUnknown(c.value));
        if (verified.some((c, i) => verified.slice(i + 1).some(d => compareClaims(attribute, c.value, d.value) === 'CONFLICT')))
            continue;
        for (const c of verified) {
            const parsed = claimSchema.safeParse({ ...(c.entryId ? { entryId: c.entryId } : { variantId: c.variantId }), attribute, value: c.value, basis: c.basis, sourceId: c.sourceId, sourceUrl: c.sourceUrl, observedAt: c.observedAt.toISOString() });
            if (!parsed.success || isExplicitUnknown(parsed.data.value))
                continue;
            const d = parsed.data, value = d.attribute === 'weight' && !isExplicitUnknown(d.value) ? `${d.value.amount} ${d.value.unit} · ${d.value.sizeSystem} ${d.value.size}${d.value.method ? ` · ${d.value.method}` : ''}` : Array.isArray(d.value) ? d.value.join(', ') : String(d.value);
            result.push({ attribute, value, sourceUrl: c.sourceUrl, sourceName: c.source.name, sourceType: c.source.type, basis: c.basis, observedAt: c.observedAt.toISOString(), reviewedAt: c.reviewedAt!.toISOString() });
        }
    }
    return result;
}
