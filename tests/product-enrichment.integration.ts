import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { TestContext } from 'node:test';
import type pg from 'pg';
import sharp from 'sharp';
import {prepareEnrichment} from '../src/lib/enrichment/plan';
type Browser = {
    request(path: string, init?: RequestInit): Promise<Response>;
};
export async function productEnrichmentTests(t: TestContext, { db, base, alice, bob, aliceId, bobId, storage }: {
    db: pg.Client;
    base: string;
    alice: Browser;
    bob: Browser;
    aliceId: string;
    bobId: string;
    storage: boolean;
}) {
    assert.match((await db.query('SELECT current_database() n')).rows[0].n, /^bootverse_auth_test_/);
    const roles = (await db.query('SELECT id,role FROM "User" WHERE id=ANY($1)', [[aliceId, bobId]])).rows, sourceId = 'd3-fixture-source', observedAt = new Date(Date.now() - 10000).toISOString();
    let ticket = '', batchId = '', imageId = '', imageMetadataId = '';
    const post = (path: string, body: unknown, actor = bob) => actor.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const row = (patch: Record<string, unknown> = {}) => ({ entryId: 'd3-entry-1', variantId: 'd3-fg-elite', sourceUrl: 'https://example.test/d3', observedAt, sourceRevision: 'synthetic-doc-1', specifications: [{ attribute: 'upperMaterial', value: '  Synthetic   upper ', basis: 'REPORTED' }], images: [], ...patch });
    const request = (rows: unknown[]) => ({ sourceId, rows });
    const preview = async (input: unknown) => { const r = await post('/api/admin/product-enrichments/preview', input); assert.equal(r.status, 200, await r.clone().text()); return r.json(); };
    const execute = (input: unknown, previewTicket: string, key: string = randomUUID()) => post('/api/admin/product-enrichments', { request: input, ticket: previewTicket, idempotencyKey: key, confirmed: true });
    const count = async (table: string) => (await db.query(`SELECT count(*)::int n FROM "${table}"`)).rows[0].n;
    const input = request([row()]);
    try {
        await db.query(`UPDATE "User" SET role=CASE WHEN id=$1 THEN 'ADMIN'::"Role" ELSE 'USER'::"Role" END WHERE id=ANY($2)`, [bobId, [aliceId, bobId]]);
        await db.query(`INSERT INTO "ProductSource"(id,name,type,"baseUrl","accessMethod","authorizationStatus","permissionNotes","permissionUrl","authorizationCheckedAt","updatedAt") VALUES($1,'Synthetic D3 source','MANUAL_RESEARCH','https://example.test','Synthetic owned fixtures','NOT_REQUIRED','Synthetic fixtures; no third-party content','https://example.test/policy',now(),now())`, [sourceId]);
        await db.query(`INSERT INTO "BootBrand"(id,name) VALUES('d3-brand','Synthetic D3 brand'); INSERT INTO "BootFamily"(id,"brandId",name) VALUES('d3-family','d3-brand','Synthetic family'); INSERT INTO "BootGeneration"(id,"familyId",name) VALUES('d3-generation','d3-family','Synthetic generation'); INSERT INTO "BootTier"(id,"generationId",name) VALUES('d3-elite','d3-generation','Elite'),('d3-pro','d3-generation','Pro'); INSERT INTO "BootColorway"(id,"generationId",name) VALUES('d3-color','d3-generation','Synthetic blue'); INSERT INTO "BootVariant"(id,"tierModelId","generationId",surface) VALUES('d3-fg-elite','d3-elite','d3-generation','FG'),('d3-ag-elite','d3-elite','d3-generation','AG'),('d3-fg-pro','d3-pro','d3-generation','FG')`);
        for (const [n, variant] of [[1, 'd3-fg-elite'], [2, 'd3-ag-elite'], [3, 'd3-fg-pro']] as const) {
            await db.query(`INSERT INTO "CatalogueEntry"(id,slug,"outsoleVariantId","colorwayId","generationId","sourceId",sample) VALUES($1,$1,$2,'d3-color','d3-generation',$3,false)`, ['d3-entry-' + n, variant, sourceId]);
            await db.query(`INSERT INTO "ProductIdentifier"(id,"entryId","brandId",value,region,"sourceId","sourceUrl","updatedAt") VALUES($1,$1,'d3-brand',$2,'GLOBAL',$3,'https://example.test/d3',now())`, ['d3-entry-' + n, 'SYNTHETIC-D3-' + n, sourceId]);
        }
        await t.test('D3 server authorization, origin, input and exact variant boundaries', async () => {
            for (const path of ['/api/admin/product-enrichments/preview', '/api/admin/product-enrichments']) {
                assert.equal((await fetch(base + path, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify(input) })).status, 401);
                assert.equal((await post(path, input, alice)).status, 403);
            }
            assert.equal((await bob.request('/api/admin/product-enrichments/preview', { method: 'POST', headers: { Origin: 'https://evil.example.test', 'Content-Type': 'application/json' }, body: JSON.stringify(input) })).status, 403);
            const mismatch = await preview(request([row({ variantId: 'd3-ag-elite' })]));
            assert.equal(mismatch.ready, false);
            assert.equal(mismatch.ticket, null);
            assert.equal((await post('/api/admin/product-enrichments/preview', request([row({ sourceUrl: 'https://example.test/?api_key=synthetic-secret' })]))).status, 400);
            assert.equal((await post('/api/admin/product-enrichments/preview', request([row({ specifications: [{ attribute: 'weight', value: { amount: 200, unit: 'lb' }, basis: 'REPORTED' }] })]))).status, 400);
        });
        await t.test('D3 preview is read-only and saves normalized observations with original revision/provenance atomically', async () => {
            const before = [await count('ProductClaim'), await count('ProductImportBatch')];
            const p = await preview(input);
            ticket = p.ticket;
            assert.deepEqual([await count('ProductClaim'), await count('ProductImportBatch')], before);
            assert.equal(p.summary.observations, 1);
            const r = await execute(input, ticket, 'synthetic-d3-intent-0001');
            assert.equal(r.status, 200, await r.clone().text());
            const b = await r.json();
            batchId = b.id;
            assert.equal(b.purpose, 'ENRICHMENT');
            assert.equal(b.status, 'SUCCEEDED');
            const c = (await db.query(`SELECT * FROM "ProductClaim" WHERE "entryId"='d3-entry-1'`)).rows[0];
            assert.equal(c.value, 'Synthetic upper');
            assert.equal(c.sourceRevision, 'synthetic-doc-1');
            assert.deepEqual(c.originalObservation, { value: '  Synthetic   upper ', changes: ['text_whitespace'] });
            assert.equal(c.status, 'UNVERIFIED');
            assert.equal(c.reviewerId, null);
            assert.equal(c.observedAt.toISOString(), observedAt);
            assert.ok(c.importRowId);
            assert.equal((await fetch(base + '/boots/d3-entry-1')).status, 404);
        });
        await t.test('D3 retries and repeated intents never duplicate claims or products', async () => {
            const before = [await count('ProductClaim'), await count('CatalogueEntry')];
            const replay = await execute(input, ticket, 'synthetic-d3-intent-0001');
            assert.equal(replay.status, 200);
            assert.equal((await replay.json()).id, batchId);
            const p = await preview(input);
            assert.equal(p.summary.noops, 1);
            assert.equal((await execute(input, p.ticket)).status, 200);
            assert.deepEqual([await count('ProductClaim'), await count('CatalogueEntry')], before);
            assert.equal((await execute(request([row({ sourceRevision: 'changed' })]), ticket, 'synthetic-d3-intent-0001')).status, 400);
        });
        await t.test('D3 preserves verified claims, records true contradictions and does not misclassify different shoe sizes', async () => {
            await db.query(`UPDATE "ProductClaim" SET status='VERIFIED',"reviewedAt"=now(),"reviewNote"='Synthetic reviewed fixture',"reviewerId"=$1 WHERE "entryId"='d3-entry-1'`, [bobId]);
            const different = request([row({ sourceRevision: 'doc-2', specifications: [{ attribute: 'upperMaterial', value: 'Synthetic contradiction', basis: 'REPORTED' }] })]);
            const p = await preview(different);
            assert.equal(p.summary.conflicts, 1);
            assert.ok(p.rows[0].claims[0].conflicts[0].sourceUrl);
            assert.equal((await execute(different, p.ticket)).status, 200);
            const cs = (await db.query(`SELECT value,status FROM "ProductClaim" WHERE "entryId"='d3-entry-1' ORDER BY value::text`)).rows;
            assert.ok(cs.some(c => c.value === 'Synthetic upper' && c.status === 'VERIFIED'));
            assert.ok(cs.some(c => c.value === 'Synthetic contradiction' && c.status === 'CONFLICTED'));
            await db.query(`UPDATE "CatalogueEntry" SET specifications=$1::jsonb WHERE id='d3-entry-3'`,[JSON.stringify({upper:{status:'verified',value:'Synthetic legacy attributed upper',sourceUrl:'https://example.test/legacy',observedAt}})]);
            const legacy=await preview(request([row({entryId:'d3-entry-3',variantId:'d3-fg-pro',specifications:[{attribute:'upperMaterial',value:'Synthetic conflicting replacement',basis:'REPORTED'}]})]));assert.equal(legacy.summary.conflicts,1);assert.equal(legacy.rows[0].claims[0].conflicts[0].sourceUrl,'https://example.test/legacy');
            const weights = request([row({ entryId: 'd3-entry-2', variantId: 'd3-ag-elite', specifications: [{ attribute: 'weight', basis: 'MEASURED', value: { amount: 0.2, unit: 'kg', size: '8', sizeSystem: 'UK', method: 'Synthetic one-shoe method' } }] }), row({ entryId: 'd3-entry-2', variantId: 'd3-ag-elite', specifications: [{ attribute: 'weight', basis: 'MEASURED', value: { amount: 210, unit: 'g', size: '9', sizeSystem: 'UK', method: 'Synthetic one-shoe method' } }] })]);
            const w = await preview(weights);
            assert.equal(w.summary.conflicts, 0);
            assert.equal((await execute(weights, w.ticket)).status, 200);
            const quality = await (await bob.request('/api/admin/products/d3-entry-1/enrichment')).json();
            assert.equal(quality.quality.publication.ready, false);
            assert.equal(quality.quality.verification.unresolvedConflicts, 1);
            assert.ok(quality.quality.issues.includes('identity_not_verified'));
        });
        await t.test('D3 batch reuses D2 exact matching and refuses new products or tier/outsole changes', async () => {
            const feed = (patch: Record<string, unknown> = {}) => ({ sourceId, feed: { format: 'JSON', content: JSON.stringify({ version: 1, products: [{ recordId: 'synthetic-d3-feed', brand: 'Synthetic D3 brand', family: 'Synthetic family', generation: 'Synthetic generation', tier: 'Pro', outsole: 'FG', colorway: 'Synthetic blue', sku: 'SYNTHETIC-D3-3', skuRegion: 'GLOBAL', sourceUrl: 'https://example.test/d3', observedAt, specifications: [{ attribute: 'heelStructure', value: 'Synthetic heel report', basis: 'REPORTED' }], ...patch }] }), mapping: {} } });
            const p = await preview(feed());
            assert.equal(p.rows[0].entryId, 'd3-entry-3');
            assert.equal((await execute(feed(), p.ticket)).status, 200);
            assert.equal((await post('/api/admin/product-enrichments/preview', feed({ outsole: 'AG' }))).status, 400);
            assert.equal((await post('/api/admin/product-enrichments/preview', feed({ tier: 'Elite' }))).status, 400);
            assert.equal((await post('/api/admin/product-enrichments/preview', feed({ recordId: 'new', sku: 'NEW-SYNTHETIC' }))).status, 400);
        });
        await t.test('D3 stale preview, revoked permissions and invalid checks do not produce partial writes', async () => {
            const data = request([row({ entryId: 'd3-entry-3', variantId: 'd3-fg-pro', specifications: [{ attribute: 'collarType', value: 'Synthetic low collar', basis: 'REPORTED' }] })]), p = await preview(data);
            await db.query(`UPDATE "CatalogueEntry" SET version=version+1 WHERE id='d3-entry-3'`);
            assert.equal((await execute(data, p.ticket)).status, 409);
            const fresh = await preview(data);
            await db.query(`UPDATE "ProductSource" SET "authorizationStatus"='DENIED' WHERE id=$1`, [sourceId]);
            assert.equal((await execute(data, fresh.ticket)).status, 400);
            await db.query(`UPDATE "ProductSource" SET "authorizationStatus"='NOT_REQUIRED' WHERE id=$1`, [sourceId]);
            const ready = await preview(data), before = [await count('ProductClaim'), await count('ProductImportBatch')];
            await db.query(`CREATE FUNCTION d3_fail_claim() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.attribute='collarType' THEN RAISE EXCEPTION 'Synthetic D3 rollback fixture'; END IF; RETURN NEW; END $$; CREATE TRIGGER d3_fail_claim BEFORE INSERT ON "ProductClaim" FOR EACH ROW EXECUTE FUNCTION d3_fail_claim()`);
            try {
                const r = await execute(data, ready.ticket);
                assert.ok(r.status >= 400);
                assert.deepEqual([await count('ProductClaim'), await count('ProductImportBatch')], before);
            }
            finally {
                await db.query('DROP TRIGGER d3_fail_claim ON "ProductClaim"; DROP FUNCTION d3_fail_claim()');
            }
            await assert.rejects(db.query(`INSERT INTO "ProductClaim"(id,"entryId",attribute,value,basis,"sourceId","sourceUrl","observedAt","updatedAt") VALUES('d3-invalid','d3-entry-1','weight','{"amount":-1,"unit":"g","size":"8","sizeSystem":"UK"}','MEASURED',$1,'https://example.test',now(),now())`, [sourceId]), /check constraint/);
        });
        await t.test('D3 reports retain source associations and exclude drafts from public pages', async () => {
            const r = await bob.request('/api/admin/product-imports/' + batchId);
            assert.equal(r.status, 200);
            const d = await r.json();
            assert.equal(d.rows[0].entryId, 'd3-entry-1');
            assert.ok(d.rows[0].sourceUrl);
            assert.match(JSON.stringify(d), /synthetic-doc-1/);
            assert.doesNotMatch(JSON.stringify(d), /api[_-]?key|password|authorizationBearer/i);
            await db.query(`UPDATE "CatalogueEntry" SET published=true WHERE id='d3-entry-1'`);
            const html = await (await fetch(base + '/boots/d3-entry-1')).text();
            assert.ok(!html.includes('Synthetic contradiction'));
            assert.ok(!html.includes('synthetic-doc-1'));
            assert.match(html, /No additional unambiguous/);
            await db.query(`UPDATE "CatalogueEntry" SET published=false WHERE id='d3-entry-1'`);
        });
        if (storage)
            await t.test('D3 product uploads validate bytes, deduplicate files, enforce admin/ownership and protect unlicensed assets', async () => {
                const bytes = await sharp({ create: { width: 80, height: 60, channels: 3, background: '#3b525b' } }).png().toBuffer(), path = '/api/images?kind=PRODUCT&id=d3-entry-3';
                assert.equal((await alice.request(path, { method: 'POST', body: new Uint8Array(bytes) })).status, 403);
                assert.equal((await bob.request(path, { method: 'POST', body: '<svg>not allowed</svg>' })).status, 400);
                const uploaded = await bob.request(path, { method: 'POST', body: new Uint8Array(bytes) });
                assert.equal(uploaded.status, 201, await uploaded.clone().text());
                const image = (await uploaded.json()).image;
                imageId = image.id;
                assert.equal((await (await bob.request(path, { method: 'POST', body: new Uint8Array(bytes) })).json()).image.id, imageId);
                assert.equal((await fetch(base + '/api/images/' + imageId)).status, 404);
                assert.equal((await alice.request('/api/images/' + imageId)).status, 404);
                const rowData = row({ entryId: 'd3-entry-3', variantId: 'd3-fg-pro', specifications: [], images: [{ uploadedImageId: imageId, sourceUrl: 'https://example.test/photo', attribution: 'Synthetic owned fixture', altText: 'Synthetic QA product image', licenseStatus: 'UNKNOWN', isPrimary: true }] });
                const data = request([rowData]), p = await preview(data);
                assert.equal((await execute(data, p.ticket)).status, 200);
                imageMetadataId = (await db.query('SELECT id FROM "ProductImage" WHERE "uploadedImageId"=$1', [imageId])).rows[0].id;
                await db.query(`UPDATE "CatalogueEntry" SET published=true WHERE id='d3-entry-3'`);
                assert.equal((await fetch(base + '/api/images/' + imageId)).status, 404);
                assert.ok(!(await (await fetch(base + '/boots/d3-entry-3')).text()).includes('Synthetic QA product image'));
                const metadata = (await db.query('SELECT * FROM "ProductImage" WHERE id=$1', [imageMetadataId])).rows[0];
                const denied = await bob.request('/api/admin/product-images/' + imageMetadataId, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'VERIFIED', version: metadata.version, note: 'Synthetic attempted approval', sourceChecked: true }) });
                assert.ok([400, 409].includes(denied.status));
                const cross = request([row({ entryId: 'd3-entry-2', variantId: 'd3-ag-elite', specifications: [], images: rowData.images })]);
                assert.equal((await post('/api/admin/product-enrichments/preview', cross)).status, 400);
                const rightsPath='/api/admin/product-images/'+imageMetadataId+'/rights',rights={version:metadata.version,licenseStatus:'GRANTED',permissionNotes:'Synthetic owner permission for this isolated test',permissionUrl:'https://example.test/license',note:'Synthetic owned fixture rights checked for local QA'};
                assert.equal((await alice.request(rightsPath,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(rights)})).status,403);
                assert.equal((await bob.request(rightsPath,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({...rights,permissionUrl:null})})).status,400);
                const rightsResult=await bob.request(rightsPath,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(rights)});assert.equal(rightsResult.status,200);let current=await rightsResult.json();assert.equal(current.status,'UNVERIFIED');
                const audit=(await db.query(`SELECT details FROM "ModerationAction" WHERE "targetKey"=$1 AND action=$2`,["IMAGE_METADATA:"+imageMetadataId,"ASSET_RIGHTS"])).rows[0].details;assert.equal(audit.before.licenseStatus,"UNKNOWN");assert.equal(audit.after.licenseStatus,"GRANTED");
                assert.equal((await fetch(base+'/api/images/'+imageId)).status,404);
                for(const status of ['PENDING_REVIEW','VERIFIED']){const r=await bob.request('/api/admin/product-images/'+imageMetadataId,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:current.version,status,note:'Synthetic isolated asset source and usage rights checked',sourceChecked:true})});assert.equal(r.status,200,await r.clone().text());current=await r.json();}
                assert.equal((await fetch(base + '/api/images/' + imageId)).status, 200);
                assert.match(await (await fetch(base + '/boots/d3-entry-3')).text(), /Synthetic QA product image/);
                const m = (await db.query('SELECT * FROM "ProductImage" WHERE id=$1', [imageMetadataId])).rows[0];
                const presentation = await bob.request('/api/admin/product-images/' + imageMetadataId + '/presentation', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: m.version, altText: 'Synthetic updated accessible label', sortOrder: 3, isPrimary: true }) });
                assert.equal(presentation.status, 200);
                const latest=(await db.query('SELECT version FROM "ProductImage" WHERE id=$1',[imageMetadataId])).rows[0];
                assert.equal((await bob.request(rightsPath,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({...rights,version:latest.version,licenseStatus:'DENIED',note:'Synthetic revoked rights must remove public access'})})).status,200);assert.equal((await fetch(base+'/api/images/'+imageId)).status,404);
                assert.equal((await bob.request('/api/images/' + imageId, { method: 'DELETE' })).status, 204);
                assert.equal((await db.query('SELECT count(*)::int n FROM "ProductImage" WHERE id=$1', [imageMetadataId])).rows[0].n, 0);
                assert.ok((await db.query('SELECT count(*)::int n FROM "StorageDeletion"')).rows[0].n > 0);
            });
        if(storage)await t.test('D3 product image quantity honors the configured per-content limit',async()=>{
            const ids:string[]=[];
            const limit=(await (await bob.request('/api/images?kind=PRODUCT&id=d3-entry-2')).json()).limits.quantity;
            for(let n=0;n<limit;n++){
                const bytes=await sharp({create:{width:12,height:12,channels:3,background:{r:20+n*40,g:60,b:100}}}).png().toBuffer();
                const r=await bob.request('/api/images?kind=PRODUCT&id=d3-entry-2',{method:'POST',body:new Uint8Array(bytes)});assert.equal(r.status,201,await r.clone().text());ids.push((await r.json()).image.id);
            }
            const bytes=await sharp({create:{width:12,height:12,channels:3,background:'#ff00ff'}}).png().toBuffer();
            assert.equal((await bob.request('/api/images?kind=PRODUCT&id=d3-entry-2',{method:'POST',body:new Uint8Array(bytes)})).status,409);
            for(const id of ids)assert.equal((await bob.request('/api/images/'+id,{method:'DELETE'})).status,204);
        });
        if (process.env.BOOTVERSE_IMPORT_BENCHMARK === '1')
            await t.test('D3 synthetic 10/100/1000-row enrichment benchmark and repeat no-ops', async () => {
                for (const size of [10, 100, 1000]) {
                    const rows = Array.from({ length: size }, (_, n) => row({ entryId: 'd3-entry-2', variantId: 'd3-ag-elite', sourceRevision: `synthetic-benchmark-${size}-${n}`, specifications: [{ attribute: 'upperTechnology', value: 'Synthetic benchmark construction', basis: 'REPORTED' }] })), data = request(rows), start = performance.now(), p = await preview(data), previewMs = performance.now() - start, write = performance.now(), r = await execute(data, p.ticket);
                    assert.equal(r.status, 200, await r.clone().text());
                    const writeMs=performance.now()-write;
                    const batch = await r.json();
                    assert.equal(batch.summary.observations, size);
                    const repeat = await preview(data);
                    assert.equal(repeat.summary.observations, 0);
                    assert.equal(repeat.summary.noops, size);
                    const conflictStart=performance.now(),conflictPlan=prepareEnrichment(rows,{id:sourceId,version:1},[{id:'d3-entry-2',outsoleVariantId:'d3-ag-elite',version:1,claims:[{id:'synthetic-conflict',attribute:'upperTechnology',value:'Synthetic conflicting source observation',status:'VERIFIED',sourceUrl:'https://example.test/prior'}],productImages:[]}]);
                    assert.equal(conflictPlan.summary.conflicts,size);const conflictPreviewMs=performance.now()-conflictStart;
                    console.log('D3_BENCHMARK ' + JSON.stringify({ rows: size, previewMs, writeMs,conflictPreviewMs, serverMs: batch.summary.durationMs, processHighWaterRssKb: batch.summary.processHighWaterRssKb, queryCount: batch.summary.queryCount }));
                }
            });
    }
    finally {
        for (const r of roles)
            await db.query('UPDATE "User" SET role=$1 WHERE id=$2', [r.role, r.id]);
    }
}
