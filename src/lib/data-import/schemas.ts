import {z} from 'zod';
import {publicSourceUrl,dataId} from '@/lib/product-data/validation';
const label=(max=120)=>z.string().trim().min(1).max(max).transform(v=>v.normalize('NFC').replace(/\s+/gu,' '));
const opaqueId=z.string().trim().min(1).max(120).transform(v=>v.normalize('NFC'));
export const recordSchema=z.object({
 recordId:opaqueId,brand:label(100),family:label(),generation:label(),tier:label(100),outsole:z.string().max(120).nullable().optional(),
 colorway:label(),sku:z.string().trim().min(1).max(120).nullable().optional(),skuRegion:z.string().regex(/^(UNSPECIFIED|GLOBAL|[A-Z]{2})$/).default('UNSPECIFIED'),
 constructionKey:opaqueId.nullable().optional(),manufacturerOutsole:label(120).nullable().optional(),
 swatch:z.string().regex(/^#[a-f0-9]{6}$/i).nullable().optional(),colorNames:z.array(label(60)).max(12).default([]),
 sourceUrl:publicSourceUrl,observedAt:z.iso.datetime({offset:true}).refine(v=>Date.parse(v)<=Date.now(),'Observation is in the future.'),
 specifications:z.array(z.unknown()).max(20).default([]),images:z.array(z.unknown()).max(4).default([]),offers:z.array(z.unknown()).max(8).default([]),
}).strict();
export const columns=['recordId','brand','family','generation','tier','outsole','colorway','sku','skuRegion','constructionKey','manufacturerOutsole','swatch','colorNames','sourceUrl','observedAt','specifications','images','offers'] as const;
export const mappingSchema=z.partialRecord(z.enum(columns),z.string().trim().min(1).max(120)).refine(v=>new Set(Object.values(v)).size===Object.values(v).length,'Map each input column only once.');
export const importRequestSchema=z.object({sourceId:dataId,format:z.enum(['CSV','JSON']),content:z.string().min(1),mapping:mappingSchema.default({})}).strict();
export const executionSchema=importRequestSchema.extend({ticket:z.string().min(1).max(2000),idempotencyKey:z.string().regex(/^[A-Za-z0-9_-]{16,100}$/),confirmed:z.literal(true)});
export type ImportRequest=z.infer<typeof importRequestSchema>;
