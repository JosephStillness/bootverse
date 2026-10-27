import { z } from 'zod';
import { dataId, publicSourceUrl } from '@/lib/product-data/validation';
import { importRequestSchema } from '@/lib/data-import/schemas';
export const enrichmentRow = z.object({ entryId: dataId, variantId: dataId, sourceUrl: publicSourceUrl, observedAt: z.iso.datetime({ offset: true }).refine(v => Date.parse(v) <= Date.now()), sourceRevision: z.string().trim().min(1).max(200).nullable().optional(), specifications: z.array(z.unknown()).max(30).default([]), images: z.array(z.unknown()).max(8).default([]) }).strict().refine(r => r.specifications.length + r.images.length > 0, 'Add at least one observation or asset.');
export const enrichmentRequest = z.union([
    z.object({ sourceId: dataId, rows: z.array(enrichmentRow).min(1).max(1000) }).strict(),
    z.object({ sourceId: dataId, feed: importRequestSchema.omit({ sourceId: true }) }).strict(),
]);
export const enrichmentExecution = z.object({ request: enrichmentRequest, ticket: z.string().min(1).max(2000), idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,100}$/), confirmed: z.literal(true) }).strict();
export type EnrichmentRequest = z.infer<typeof enrichmentRequest>;
export type EnrichmentRow = z.infer<typeof enrichmentRow>;

export const assetRightsSchema=z.object({version:z.number().int().positive(),licenseStatus:z.enum(['UNKNOWN','GRANTED','DENIED']),permissionNotes:z.string().trim().min(1).max(1000).nullable(),permissionUrl:publicSourceUrl.nullable(),note:z.string().trim().min(10).max(1000)}).strict().refine(v=>v.licenseStatus!=='GRANTED'||!!v.permissionNotes&&!!v.permissionUrl,'Document usage permission with a reference and notes.');
