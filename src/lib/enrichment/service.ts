import 'server-only';
import { recordRevision } from '@/lib/product-review/facts';
import {legacyObservations} from '@/lib/product-data/legacy';
import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';
import { getDb } from '@/lib/db';
import { lockedActiveUser } from '@/lib/accounts/authorization-db';
import type { Principal } from '@/lib/accounts/authorization';
import { CommunityError } from '@/lib/community/service';
import { importAdmin, localImportsOnly } from '@/lib/data-import/service';
import { importLimits, ImportInputError } from '@/lib/data-import/types';
import { prepareImport, digest } from '@/lib/data-import/preview';
import { parseInput } from '@/lib/data-import/parse';
import { readGraph } from '@/lib/data-import/snapshot';
import { signPreview, verifyPreview } from '@/lib/data-import/ticket';
import { enrichmentRequest, enrichmentExecution,assetRightsSchema, type EnrichmentRequest } from './contracts';
import { prepareEnrichment, type EnrichmentPlan } from './plan';
import { qualityAssessment, freshnessPolicy } from './quality';
type Tx = Prisma.TransactionClient;
const limits = () => ({ ...importLimits(), maxRows: Math.min(1000, importLimits().maxRows) });
const hash = (input: EnrichmentRequest) => digest({ purpose: 'ENRICHMENT', version: 1, input });
async function sourceForEnrichment(tx: Tx, id: string) {
    const source = await tx.productSource.findUnique({ where: { id } });
    if (!source || source.status !== 'ACTIVE' || !['GRANTED', 'NOT_REQUIRED'].includes(source.authorizationStatus) || !source.permissionNotes || !source.permissionUrl || !source.authorizationCheckedAt)
        throw new CommunityError(400, 'Document source access permission before enrichment.');
    return source;
}
async function resolveRows(tx: Tx, input: EnrichmentRequest, actorId: string) {
    if ('rows' in input)
        return input.rows;
    const feed = { ...input.feed, sourceId: input.sourceId }, source = await sourceForEnrichment(tx, input.sourceId);
    const parsed = parseInput(feed.content, feed.format, feed.mapping, limits());
    const plan = prepareImport(feed, source, await readGraph(tx, feed, actorId, limits()), limits());
    return plan.rows.map((r, i) => {
        // A claim contradiction may still identify the exact product; identity contradictions never do.
        if (!r.entryId || !r.variantId || !r.data || !['EXACT_MATCH', 'CONFLICT'].includes(r.outcome) || r.diagnostics.some(d => ['existing_identity_changed', 'source_sku_disagreement', 'contradictory_file_identifier'].includes(d)))
            throw new ImportInputError(`Row ${r.row}: enrichment requires an exact existing identity. Import or resolve it first.`);
        const original = z.object({ specifications: z.array(z.unknown()).optional() }).passthrough().parse(parsed.rows[i].value);
        if (r.data.offers.length)
            throw new ImportInputError('Enrichment does not change prices or stock; use the attributed offer workflow.');
        return { entryId: r.entryId, variantId: r.variantId, sourceUrl: r.data.sourceUrl, observedAt: r.data.observedAt, specifications: original.specifications ?? [], images: r.data.images.map(({ sourceId, ...image }) => { void sourceId; return image; }) };
    });
}
async function prepare(tx: Tx, input: EnrichmentRequest, actorId: string) {
    const source = await sourceForEnrichment(tx, input.sourceId), rows = await resolveRows(tx, input, actorId), ids = [...new Set(rows.map(r => r.entryId))];
    const entries = await tx.catalogueEntry.findMany({ where: { id: { in: ids } }, select: { id: true,sample:true,specifications:true, outsoleVariantId: true, version: true, variant: { select: { surface: true, tier: { select: { generation: { select: { family: { select: { brandId: true } } } } } } } } }, orderBy: { id: 'asc' } });
    if (source.type === 'MANUFACTURER' && entries.some(e => e.variant.tier.generation.family.brandId !== source.brandId))
        throw new ImportInputError('Manufacturer source does not match the product brand.');
    const imagesForEntries=await tx.productImage.findMany({where:{entryId:{in:ids}},select:{id:true,entryId:true,assetKey:true,externalUrl:true,uploadedImageId:true,isPrimary:true,status:true,version:true},orderBy:{id:'asc'},take:10001});
    if(imagesForEntries.length>10000)throw new ImportInputError('Asset scope is too large. Split the batch.');
    const imagesByEntry=new Map<string,typeof imagesForEntries>();
    for(const i of imagesForEntries){const list=imagesByEntry.get(i.entryId)??[];list.push(i);imagesByEntry.set(i.entryId,list);}
    const variantIds = [...new Set(entries.map(e => e.outsoleVariantId))];
    const claims = await tx.productClaim.findMany({ where: { OR: [{ entryId: { in: ids } }, { variantId: { in: variantIds } }] }, select: { id: true, entryId: true, variantId: true, attribute: true, value: true, status: true, sourceUrl: true, observationKey: true, version: true }, orderBy: { id: 'asc' }, take: 50001 });
    if (claims.length > 50000)
        throw new ImportInputError('Evidence scope is too large. Split the batch.');
    const grouped = new Map<string, typeof claims>();
    for (const c of claims) {
        const k = c.entryId ? 'e:' + c.entryId : 'v:' + c.variantId;
        grouped.set(k, [...(grouped.get(k) ?? []), c]);
    }
    const plan = prepareEnrichment(rows, source, entries.map(e => ({ ...e, productImages:imagesByEntry.get(e.id)??[],surface: e.variant.surface, claims: [...legacyObservations(e),...(grouped.get('e:' + e.id) ?? []), ...(grouped.get('v:' + e.outsoleVariantId) ?? [])] })));
    const images = plan.rows.flatMap(r => r.images.filter(i => i.uploadedImageId).map(i => ({ entryId: r.entryId, id: i.uploadedImageId! })));
    if (images.length) {
        const uploads = await tx.uploadedImage.findMany({ where: { id: { in: [...new Set(images.map(i => i.id))] }, ownerId: actorId, state: 'READY', status: 'PUBLISHED' }, select: { id: true, productEntryId: true } });
        for (const i of images)
            if (!uploads.some(u => u.id === i.id && u.productEntryId === i.entryId))
                throw new ImportInputError('Use your own ready product upload for this exact entry.');
    }
    return { source, plan };
}
export async function previewEnrichment(actor: Principal | null, raw: unknown) {
    localImportsOnly();
    const user = importAdmin(actor), input = enrichmentRequest.parse(raw);
    return getDb().$transaction(async (tx) => { await tx.$executeRaw `SET TRANSACTION READ ONLY`; importAdmin(await tx.user.findUnique({ where: { id: user.id }, select: { id: true, role: true, status: true, emailVerified: true } })); const { plan } = await prepare(tx, input, user.id); return { ...plan, ticket: plan.ready ? signPreview(user.id, hash(input), plan.hash, process.env.AUTH_SECRET ?? '') : null }; }, { isolationLevel: 'RepeatableRead', timeout: 30000 });
}
// Also used by D5 source sync so evidence persistence has one implementation.
export async function persist(tx: Tx, plan: EnrichmentPlan, batchId: string) {
    const rows: Prisma.ProductImportRowCreateManyInput[] = [], claims: Prisma.ProductClaimCreateManyInput[] = [], images: Prisma.ProductImageCreateManyInput[] = [];
    for (const row of plan.rows) {
        const id = crypto.randomUUID();
        rows.push({ id, batchId, rowNumber: row.row, recordId: row.entryId, entryId: row.entryId, sourceUrl: row.sourceUrl, observedAt: new Date(row.observedAt), checksum: digest(row), outcome: row.claims.some(c => c.status === 'CONFLICTED') ? 'CONFLICT' : 'EXACT_MATCH', action: row.claims.every(c => c.duplicate) && row.images.every(i => i.duplicate) ? 'NOOP' : 'STAGE', data: JSON.parse(JSON.stringify(row)), diagnostics: row.claims.flatMap(c => c.conflicts.map(x => `${c.attribute}: ${x.id}`)).slice(0, 30) });
        for (const c of row.claims)
            if (!c.duplicate) {
                const { duplicate, conflicts, originalObservation, ...data } = c;
                void duplicate;
                void conflicts;
                claims.push({ ...data, value: data.value, originalObservation: JSON.parse(JSON.stringify(originalObservation)), observedAt: new Date(data.observedAt), importRowId: id });
            }
        for (const i of row.images)
            if (!i.duplicate) {
                const { duplicate, ...data } = i;
                void duplicate;
                images.push({ ...data, entryId: row.entryId, importRowId: id });
            }
    }
    for (let n = 0; n < rows.length; n += 250)
        await tx.productImportRow.createMany({ data: rows.slice(n, n + 250) });
    for (let n = 0; n < claims.length; n += 250)
        await tx.productClaim.createMany({ data: claims.slice(n, n + 250) });
    for (let n = 0; n < images.length; n += 250)
        await tx.productImage.createMany({ data: images.slice(n, n + 250) });
}
export async function executeEnrichment(actor: Principal | null, raw: unknown) {
    localImportsOnly();
    const user = importAdmin(actor), data = enrichmentExecution.parse(raw), input = data.request, checksum = hash(input), start = performance.now();
    const old = await getDb().productImportBatch.findUnique({ where: { sourceId_idempotencyKey: { sourceId: input.sourceId, idempotencyKey: data.idempotencyKey } } });
    const approval = verifyPreview(data.ticket, user.id, checksum, process.env.AUTH_SECRET ?? '', Date.now(), old?.status === 'SUCCEEDED');
    if (old && (old.checksum !== checksum || old.purpose !== 'ENRICHMENT'))
        throw new CommunityError(409, 'Idempotency key belongs to another intent.');
    try {
        return await getDb().$transaction(async (tx) => {
            importAdmin(await lockedActiveUser(tx, user));
            const [lock] = await tx.$queryRaw<{
                acquired: boolean;
            }[]> `SELECT pg_try_advisory_xact_lock(734982165) AS acquired`;
            if (!lock.acquired)
                throw new CommunityError(409, 'Another data batch is running. Retry the same intent.');
            const previous = await tx.productImportBatch.findUnique({ where: { sourceId_idempotencyKey: { sourceId: input.sourceId, idempotencyKey: data.idempotencyKey } } });
            if (previous) {
                if (previous.checksum !== checksum || previous.purpose !== 'ENRICHMENT')
                    throw new CommunityError(409, 'Idempotency key belongs to another intent.');
                if (previous.status === 'SUCCEEDED')
                    return previous;
                throw new CommunityError(409, 'This intent is already running.');
            }
            await tx.$queryRaw `SELECT id FROM "ProductSource" WHERE id=${input.sourceId} FOR SHARE`;
            const targetRows = await resolveRows(tx, input, user.id), ids = [...new Set(targetRows.map(r => r.entryId))];
            await tx.$queryRaw(Prisma.sql `SELECT v.id FROM "BootVariant" v WHERE v.id IN (SELECT "outsoleVariantId" FROM "CatalogueEntry" WHERE id IN (${Prisma.join(ids)})) ORDER BY v.id FOR UPDATE`);
            await tx.$queryRaw(Prisma.sql `SELECT id FROM "CatalogueEntry" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`);
            const { source, plan } = await prepare(tx, input, user.id);
            if (!plan.ready || plan.hash !== approval.planHash)
                throw new CommunityError(409, 'Preview is stale. Inspect the current evidence again.');
            const uploadIds = [...new Set(plan.rows.flatMap(r => r.images.flatMap(i => i.uploadedImageId ? [i.uploadedImageId] : [])))];
            if (uploadIds.length)
                await tx.$queryRaw(Prisma.sql `SELECT id FROM "UploadedImage" WHERE id IN (${Prisma.join(uploadIds)}) FOR SHARE`);
            const batch = await tx.productImportBatch.create({ data: { sourceId: input.sourceId, actorId: user.id, purpose: 'ENRICHMENT', format: 'feed' in input ? input.feed.format : 'JSON', checksum, idempotencyKey: data.idempotencyKey, sourceSnapshot: { type: source.type, version: source.version, authorizationStatus: source.authorizationStatus, permissionUrl: source.permissionUrl, authorizationCheckedAt: source.authorizationCheckedAt!.toISOString() } } });
            await persist(tx, plan, batch.id);
            await tx.moderationAction.create({ data: { actorId: user.id, targetKey: `IMPORT:${batch.id}`, action: 'ENRICH_PRODUCTS', note: `Draft enrichment: ${plan.summary.observations} observations, ${plan.summary.conflicts} conflicts, ${plan.summary.assets} assets. No identity, verified value or publication changed.` } });
            return tx.productImportBatch.update({ where: { id: batch.id }, data: { status: 'SUCCEEDED', completedAt: new Date(), summary: { ...plan.summary, durationMs: Math.round(performance.now() - start), processHighWaterRssKb: process.resourceUsage().maxRSS, queryCount: null } } });
        }, { isolationLevel: 'Serializable', timeout: 120000, maxWait: 5000 });
    }
    catch (error) {
        if (error instanceof CommunityError || error instanceof ImportInputError)
            throw error;
        if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code))
            throw new CommunityError(409, 'Concurrent evidence change. Retry the same intent or preview again.');
        throw error;
    }
}
export async function enrichmentQuality(actor: Principal | null, id: string) {
    localImportsOnly();
    importAdmin(actor);
    const entry = await getDb().catalogueEntry.findUnique({ where: { id: z.string().min(1).max(100).parse(id) }, include: { source: true, identifiers: { take: 1 }, productImages: { take: 501, include: { source: { select: { status: true, authorizationStatus: true } } } }, variant: { select: { id: true, surface: true, tier: { select: { name: true } } } } } });
    if (!entry)
        throw new CommunityError(404, 'Product not found.');
    const claims = await getDb().productClaim.findMany({ where: { OR: [{ entryId: id }, { variantId: entry.outsoleVariantId }] }, take: 501, orderBy: { id: 'asc' }, include: { source: { select: { name: true, type: true, status: true, authorizationStatus: true } } } }), offers = await getDb().recommendationEvidence.findMany({ where: { entryId: id, kind: { in: ['PRICE', 'AVAILABILITY'] } }, take: 501, orderBy: { observedAt: 'desc' } });
    const quality = qualityAssessment({ identityComplete: !!entry.variant.tier.name, surfaceKnown: !!entry.variant.surface, identityVerified: false, sourceAvailable: entry.source?.status === 'ACTIVE' && ['GRANTED', 'NOT_REQUIRED'].includes(entry.source.authorizationStatus), sourceCheckedAt: entry.source?.lastCheckedAt ?? null, claims, images: entry.productImages.filter(i => i.source.status === 'ACTIVE' && i.source.authorizationStatus !== 'DENIED'), offers }, new Date(), freshnessPolicy(process.env));
    if (claims.length > 500 || entry.productImages.length > 500 || offers.length > 500) {
        quality.issues.push('assessment_scope_overflow');
        quality.publication.ready = false;
        quality.publication.blockers.push('assessment_scope_overflow');
    }
    const batches=await getDb().productImportBatch.findMany({where:{purpose:'ENRICHMENT',rows:{some:{entryId:id}}},take:20,orderBy:[{startedAt:'desc'},{id:'asc'}],select:{id:true,status:true,startedAt:true,summary:true}});
    const keys=[`PRODUCT:${id}`,...claims.map(c=>`CLAIM:${c.id}`),...entry.productImages.map(i=>`IMAGE_METADATA:${i.id}`),...batches.map(b=>`IMPORT:${b.id}`)];
    const audit=await getDb().moderationAction.findMany({where:{targetKey:{in:keys}},take:20,orderBy:[{createdAt:'desc'},{id:'asc'}],select:{id:true,action:true,note:true,details:true,createdAt:true}});
    return { entry, claims, quality,batches,audit };
}
export async function updateAssetPresentation(actor: Principal | null, id: string, raw: unknown) {
    localImportsOnly();
    const user = importAdmin(actor), data = z.object({ version: z.number().int().positive(), altText: z.string().trim().min(1).max(300), sortOrder: z.number().int().min(0).max(1000), isPrimary: z.boolean() }).strict().parse(raw);
    return getDb().$transaction(async (tx) => {
        importAdmin(await lockedActiveUser(tx, user));
        const image = await tx.productImage.findUnique({ where: { id: z.string().min(1).max(100).parse(id) }, include: { entry: { select: { outsoleVariantId: true } } } });
        if (!image)
            throw new CommunityError(404, 'Image metadata not found.');
        await tx.$queryRaw `SELECT id FROM "BootVariant" WHERE id=${image.entry.outsoleVariantId} FOR UPDATE`;
        const current = await tx.productImage.findUniqueOrThrow({ where: { id } });
        if (current.version !== data.version)
            throw new CommunityError(409, 'Image metadata changed. Reload first.');
        if (data.isPrimary)
            await tx.productImage.updateMany({ where: { entryId: image.entryId, isPrimary: true, id: { not: id } }, data: { isPrimary: false, version: { increment: 1 } } });
        const result = await tx.productImage.update({ where: { id }, data: { altText: data.altText, sortOrder: data.sortOrder, isPrimary: data.isPrimary, version: { increment: 1 } } });
        await tx.moderationAction.create({ data: { actorId: user.id, targetKey: `IMAGE_METADATA:${id}`, action: 'ORDER_PRODUCT_IMAGE', note: 'Updated alt text, ordering and primary selection; permission and verification were not changed.' } });
        await recordRevision(tx, [image.entryId], user.id, 'Image presentation updated (alt text, order or primary image).', null);
        return result;
    });
}

export async function updateAssetRights(actor:Principal|null,id:string,raw:unknown){
 localImportsOnly();const user=importAdmin(actor),data=assetRightsSchema.parse(raw);
 return getDb().$transaction(async tx=>{
  importAdmin(await lockedActiveUser(tx,user));const image=await tx.productImage.findUnique({where:{id:z.string().min(1).max(100).parse(id)},include:{entry:{select:{outsoleVariantId:true}}}});if(!image)throw new CommunityError(404,'Image metadata not found.');
  await tx.$queryRaw`SELECT id FROM "BootVariant" WHERE id=${image.entry.outsoleVariantId} FOR UPDATE`;
  const current=await tx.productImage.findUniqueOrThrow({where:{id}});if(current.version!==data.version)throw new CommunityError(409,'Asset changed. Reload before updating permissions.');
  const rights={licenseStatus:data.licenseStatus,permissionNotes:data.permissionNotes,permissionUrl:data.permissionUrl};
  const updated=await tx.productImage.update({where:{id},data:{...rights,status:'UNVERIFIED',reviewedAt:null,version:{increment:1}}});
  await tx.moderationAction.create({data:{actorId:user.id,targetKey:`IMAGE_METADATA:${id}`,action:'ASSET_RIGHTS',note:data.note,details:{before:{licenseStatus:current.licenseStatus,permissionNotes:current.permissionNotes,permissionUrl:current.permissionUrl,status:current.status,reviewedAt:current.reviewedAt?.toISOString()??null},after:{...rights,status:'UNVERIFIED'}}}});
  await recordRevision(tx,[image.entryId],user.id,`Image rights updated; public display revoked until re-verified: ${data.note}`,null);
  return updated;
 });
}
