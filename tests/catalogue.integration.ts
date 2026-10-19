import assert from 'node:assert/strict';
import type {TestContext} from 'node:test';
import type pg from 'pg';
export async function catalogueTests(t:TestContext,{db,base}:{db:pg.Client;base:string}){
 const get=(path:string)=>fetch(base+path);
 const original=(await db.query('SELECT * FROM "CatalogueEntry" ORDER BY id LIMIT 1')).rows[0];
 try{
  await t.test('catalogue: new entries are private by default and published DB entries appear without a rebuild',async()=>{
   await db.query('INSERT INTO "BootVariant"(id,"tierModelId","generationId",surface) SELECT \'remediation-variant\',"tierModelId","generationId",\'SG\' FROM "BootVariant" WHERE id=$1',[original.outsoleVariantId]);
   await db.query('INSERT INTO "CatalogueEntry"(id,slug,"outsoleVariantId","colorwayId","generationId",sample) VALUES(\'remediation-entry\',\'remediation-new-product\',\'remediation-variant\',$1,$2,false)',[original.colorwayId,original.generationId]);
   let response=await get('/api/boots?q=remediation');assert.equal(response.status,200);assert.equal((await response.json()).total,0);
   const hidden=await get('/boots/remediation-new-product');assert.equal(hidden.status,404);const hiddenHtml=await hidden.text();assert.ok(hiddenHtml.includes('404')||hiddenHtml.includes('not found'));assert.ok(!hiddenHtml.includes('Synthetic sourced upper'));
   const specs={upper:{status:'verified',value:'Synthetic sourced upper',sourceUrl:'https://example.test/qa-spec',observedAt:'2026-10-17T00:00:00Z'}};
   await db.query('UPDATE "CatalogueEntry" SET published=true,specifications=$1::jsonb WHERE id=\'remediation-entry\'',[JSON.stringify(specs)]);
   response=await get('/api/boots?surface=SG');const data=await response.json();assert.equal(response.status,200);assert.ok(data.boots.some((b:{id:string})=>b.id==='remediation-entry'));
   const page=await get('/boots/remediation-new-product');assert.equal(page.status,200);const html=await page.text();assert.ok(html.includes('Synthetic sourced upper'));assert.ok(html.includes('remediation-variant')||html.includes('Community'));assert.ok(html.includes('Unknown'));assert.ok(!html.includes('Sample configuration'));
   assert.equal((await (await get('/api/boot-variants/remediation-variant/ratings')).json()).count,0);
  });
  await t.test('catalogue: search, filters, literal wildcard input and pagination use PostgreSQL',async()=>{
   const data=await (await get('/api/boots?q=artificial%20grass&brand=nike&tier=Elite&surface=AG&sort=name-desc')).json();assert.equal(data.total,1);assert.equal(data.boots[0].variant.id,'mercurial-elite-ag');
   assert.equal((await (await get('/api/boots?q=%25_%27%22')).json()).total,0);
   assert.equal((await get('/api/boots?page=0')).status,400);
   const invalidPage=await get('/boots?page=0');assert.equal(invalidPage.status,200);assert.ok((await invalidPage.text()).includes('Check catalogue filters.'));
   assert.equal((await get('/api/boots?q='+ 'x'.repeat(101))).status,400);
   const page=await (await get('/api/boots?page=1000')).json();assert.equal(page.boots.length,0);assert.ok(page.total>=8);
  });
  await t.test('catalogue: brand sorting is case insensitive across mixed-case names',async()=>{
   const response=await get('/api/boots?sort=brand'),data=await response.json();assert.equal(response.status,200);
   const names=data.boots.map((b:{brand:{name:string}})=>b.brand.name.toLowerCase());
   assert.deepEqual(names,[...names].sort());assert.equal(data.boots[0].brand.id,'adidas');
  });
  await t.test('review summary: bounds distinct options without truncating rating aggregates',async()=>{
   try{
    await db.query(`INSERT INTO "User"(id,email,"emailVerified","updatedAt") SELECT 'remediation-options-'||n,'remediation-options-'||n||'@example.test',now(),now() FROM generate_series(1,205) n`);
    await db.query(`INSERT INTO "UserProfile"(id,"userId",username,"displayName","updatedAt") SELECT 'remediation-options-'||n,'remediation-options-'||n,'remediation-options-'||n,'Isolated QA fixture',now() FROM generate_series(1,205) n`);
    await db.query(`INSERT INTO "BootReview"(id,"authorId","variantId","sizeWorn","sizeSystem","ownershipMonths","matchesPlayed",experience,pros,cons,comfort,fit,traction,"ballTouch",durability,value,"ratingTotal","updatedAt") SELECT 'remediation-options-'||n,'remediation-options-'||n,$1,((n-1)%100+1)::text,CASE WHEN n<=100 THEN 'UK' WHEN n<=200 THEN 'US' ELSE 'EU' END,n,1,'Synthetic regression fixture only, not a real review.','QA pros','QA cons',3,3,3,3,3,3,18,now() FROM generate_series(1,205) n`,[original.outsoleVariantId]);
    const summary=await (await get('/api/boot-variants/'+original.outsoleVariantId+'/ratings')).json();assert.equal(summary.count,205);assert.equal(summary.overall,3);assert.equal(summary.options.sizes.length,200);assert.equal(summary.options.sizesTruncated,true);assert.ok(summary.options.durations.length<=3);
   }finally{await db.query(`DELETE FROM "User" WHERE id LIKE 'remediation-options-%'`);}
  });
  await t.test('health: readiness checks the migrated DB and service failures return safe correlation IDs',async()=>{
   assert.equal((await get('/api/health/live')).status,200);assert.equal((await get('/api/health/ready')).status,200);
   try{
    await db.query('ALTER TABLE "CatalogueEntry" RENAME TO "CatalogueEntry_qa_unavailable"');
    const failed=await get('/api/boots');assert.equal(failed.status,503);assert.match(failed.headers.get('x-request-id')??'',/^[a-f0-9-]{36}$/);const body=await failed.text();assert.ok(!body.includes('CatalogueEntry'));assert.ok(!body.includes('DATABASE_URL'));
   }finally{await db.query('ALTER TABLE "CatalogueEntry_qa_unavailable" RENAME TO "CatalogueEntry"');}
  });
  await t.test('comparison: exact variant selection, deduplication, unknowns and unpublished exclusion',async()=>{
   const compare=await get(`/compare?boot=${original.id}&boot=remediation-entry`);assert.equal(compare.status,200);const html=await compare.text();assert.ok(html.includes('Synthetic sourced upper'));assert.ok(html.includes('remediation-variant'));assert.ok(html.includes('Unknown'));
   await db.query('UPDATE "CatalogueEntry" SET published=false WHERE id=\'remediation-entry\'');
   const unpublished=await (await get('/compare?boot=remediation-entry')).text();assert.ok(unpublished.includes('shortlist is empty'));assert.ok(!unpublished.includes('Synthetic sourced upper'));
   assert.equal((await get('/api/boot-variants/remediation-variant/ratings')).status,404);
   assert.equal((await get('/boots/remediation-new-product')).status,404);
   assert.equal((await get('/boots/a-missing-product')).status,404);
   assert.ok((await (await get('/compare?boot=1&boot=2&boot=3&boot=4&boot=5')).text()).includes('Invalid comparison selection'));
  });
 }finally{await db.query('DELETE FROM "CatalogueEntry" WHERE id=\'remediation-entry\'');await db.query('DELETE FROM "BootVariant" WHERE id=\'remediation-variant\'');}
}
