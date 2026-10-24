import { ImportInputError } from '@/lib/data-import/types';
import { z } from 'zod';
import { productImageSchema } from '@/lib/product-data/validation';
import { digest } from '@/lib/data-import/preview';
import { normalizeObservation, compareClaims } from './observations';
import { enrichmentRow } from './contracts';
type Claim = {
    id: string;
    attribute: string;
    value: unknown;
    status: string;
    sourceUrl: string;
    observationKey?: string | null;
};
export type Target = {
    id: string;
    outsoleVariantId: string;
    version: number;
    surface?: string | null;
    claims: Claim[];
    productImages: {
        assetKey?: string | null;
        externalUrl?: string | null;
        uploadedImageId?: string | null;
        isPrimary?: boolean;
    }[];
};
export function prepareEnrichment(rawRows: unknown[], source: {
    id: string;
    version: number;
}, targets: Target[]) {
    const map = new Map(targets.map(t => [t.id, t])), keys = new Set(targets.flatMap(t => t.claims.flatMap(c => c.observationKey ? [c.observationKey] : []))), assets = new Set(targets.flatMap(t => t.productImages.flatMap(i => i.assetKey ? [t.id + ':' + i.assetKey] : [])));
    const incoming = new Map<string, Claim[]>();
    const rows = rawRows.map((raw, index) => {
        const r = enrichmentRow.parse(raw), target = map.get(r.entryId), errors: string[] = [];
        if (!target || target.outsoleVariantId !== r.variantId)
            errors.push('exact_variant_mismatch');
        if (Buffer.byteLength(JSON.stringify(r)) > 65536)
            errors.push('row_exceeds_64kb');
        const context = { entryId: r.entryId, sourceId: source.id, sourceUrl: new URL(r.sourceUrl).href, observedAt: new Date(r.observedAt).toISOString(), sourceRevision: r.sourceRevision ?? null };
        const claims = r.specifications.map(spec => {
            const s = z.record(z.string(), z.unknown()).parse(spec);
            if (Object.keys(s).some(k => !['attribute', 'value', 'basis', 'notes'].includes(k)))
                throw new ImportInputError('Observation fields must not override source, scope or verification.');
            const normalized = normalizeObservation({ ...context, ...s });
            const observationKey = digest({ ...context, attribute: normalized.attribute, value: normalized.value, basis: normalized.basis, notes: normalized.notes ?? null });
            const duplicate = keys.has(observationKey);
            keys.add(observationKey);
            const conflicts: {
                id: string;
                sourceUrl: string | null;
                value: unknown;
            }[] = [...(target?.claims ?? []), ...(incoming.get(r.entryId) ?? [])].filter(c => c.status !== 'REJECTED' && c.attribute === normalized.attribute && compareClaims(c.attribute, c.value, normalized.value) === 'CONFLICT').map(c => ({ id: c.id, sourceUrl: c.sourceUrl, value: c.value }));
            if (normalized.attribute === 'normalizedOutsoleCategory' && target?.surface && typeof normalized.value === 'string' && normalized.value !== target.surface)
                conflicts.push({ id: r.variantId, sourceUrl: null, value: target.surface });
            if (!duplicate)
                incoming.set(r.entryId, [...(incoming.get(r.entryId) ?? []), { id: `incoming-row-${index + 1}`, attribute: normalized.attribute, value: normalized.value, status: conflicts.length ? 'CONFLICTED' : 'UNVERIFIED', sourceUrl: r.sourceUrl }]);
            return { ...normalized, observationKey, duplicate, status: conflicts.length ? 'CONFLICTED' as const : 'UNVERIFIED' as const, conflicts };
        });
        if (new Set(claims.map(c => c.attribute)).size !== claims.length)
            errors.push('duplicate_attribute');
        let primary = target?.productImages.some(i => i.isPrimary) ?? false;
        const images = r.images.map(rawImage => {
            const fields = z.record(z.string(), z.unknown()).parse(rawImage);
            if ('sourceId' in fields)
                throw new ImportInputError('Image source is selected by the server.');
            const image = productImageSchema.parse({ ...fields, sourceId: source.id });
            const assetKey = digest({ uploadedImageId: image.uploadedImageId ?? null, externalUrl: image.externalUrl ?? null });
            const duplicate = assets.has(r.entryId + ':' + assetKey) || !!target?.productImages.some(i => image.uploadedImageId ? i.uploadedImageId === image.uploadedImageId : i.externalUrl === image.externalUrl);
            assets.add(r.entryId + ':' + assetKey);
            if (image.isPrimary && !duplicate) {
                if (primary)
                    errors.push('primary_image_exists');
                primary = true;
            }
            return { ...image, sourceId: source.id, assetKey, duplicate };
        });
        return { row: index + 1, entryId: r.entryId, variantId: r.variantId, sourceUrl: r.sourceUrl, observedAt: r.observedAt, claims, images, errors };
    });
    const summary = { total: rows.length, observations: rows.reduce((n, r) => n + r.claims.filter(c => !c.duplicate).length, 0), conflicts: rows.reduce((n, r) => n + r.claims.filter(c => !c.duplicate && c.conflicts.length).length, 0), assets: rows.reduce((n, r) => n + r.images.filter(i => !i.duplicate).length, 0), noops: rows.filter(r => r.claims.every(c => c.duplicate) && r.images.every(i => i.duplicate)).length, invalid: rows.filter(r => r.errors.length).length };
    return { rows, summary, ready: summary.invalid === 0, hash: digest({ source, targets, rows }) };
}
export type EnrichmentPlan = ReturnType<typeof prepareEnrichment>;
