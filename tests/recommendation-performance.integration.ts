import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import type {TestContext} from 'node:test';
import type pg from 'pg';
type Browser={request(path:string,init?:RequestInit):Promise<Response>};
// Called only by the existing disposable-local-database harness, never against the app DB.
export async function recommendationPerformanceTests(t:TestContext,{db,alice,aliceId,secret}:{db:pg.Client;alice:Browser;aliceId:string;secret:string}) {
 await t.test('bounded HTTP recommendation workload, correlation IDs, private errors and no persistence',async()=>{
  const before=(await db.query('SELECT count(*)::int n FROM "FootProfile"')).rows[0].n;
  const timing:number[]=[];let errors=0;
  const clear=async()=>{for(const slot of [Math.floor(Date.now()/900000)-1,Math.floor(Date.now()/900000)]){const key=createHmac('sha256',secret).update(`recommendations:run:${aliceId}:${slot}`).digest('hex');await db.query('DELETE FROM "RateLimit" WHERE key=$1',[key]);}};
  const ids=new Set<string>();
  let scaled=false;
  const run=async()=>{
   const start=performance.now();const response=await alice.request('/api/boot-fit/recommendations',{method:'POST',body:JSON.stringify({preferences:{unit:'mm',leftLengthMm:'280',leftWidthMm:'110',surface:'AG',budgetAmount:'200',currency:'AUD'},processingConsent:true,limit:20})});
   const body=await response.text();timing.push(performance.now()-start);if(response.status!==200)errors++;
   assert.equal(response.status,200);assert.match(response.headers.get('cache-control')??'',/no-store/);
   const id=response.headers.get('x-request-id');assert.match(id??'',/^[\da-f-]{36}$/);assert.ok(!ids.has(id!));ids.add(id!);
   const data=JSON.parse(body);assert.ok(data.counts.evaluated>0);assert.ok(!body.includes('"leftLengthMm"'));assert.ok(!body.includes('"authorId"'));
   if(scaled){assert.equal(data.counts.evaluated,100);assert.equal(data.eligible.find((r:{variantId:string})=>r.variantId==='mercurial-elite-ag').reviewAnalysis.overall.count,2000);}
  };
  try{
   const measure=async(label:string)=>{
    const sizes=await db.query('SELECT (SELECT count(*)::int FROM "BootVariant") variants,(SELECT count(*)::int FROM "BootReview") reviews');
    await clear();for(let i=0;i<4;i++)await run();timing.length=0;errors=0;
    for(let batch=0;batch<8;batch++){await clear();await Promise.all(Array.from({length:4},run));}
    timing.sort((a,b)=>a-b);const pct=(p:number)=>Math.round(timing[Math.ceil(timing.length*p)-1]*100)/100;
    console.log(JSON.stringify({benchmark:label,dataset:sizes.rows[0],warmup:4,requests:32,concurrency:4,p50Ms:pct(.5),p95Ms:pct(.95),errorRate:errors/32,sqlQueryCount:'not instrumented',memory:'app RSS not sampled; see pure benchmark',environment:'localhost production build, disposable PostgreSQL, authenticated actor, no saved profile'}));
   };
   await measure('recommendation-http-small');
   // All scale fixtures are disposable synthetic records; identities/evidence are never imported into app data.
   await db.query('INSERT INTO "BootVariant"(id,"tierModelId","generationId",surface) SELECT \'perf35-variant-\'||lpad(n::text,3,\'0\'),v."tierModelId",v."generationId",v.surface FROM "BootVariant" v CROSS JOIN generate_series(1,93) n WHERE v.id=\'mercurial-elite-ag\'');
   await db.query('INSERT INTO "CatalogueEntry"(id,slug,"outsoleVariantId","colorwayId","generationId",sample) SELECT v.id,v.id,v.id,e."colorwayId",v."generationId",false FROM "BootVariant" v CROSS JOIN "CatalogueEntry" e WHERE v.id LIKE \'perf35-variant-%\' AND e.id=(SELECT id FROM "CatalogueEntry" WHERE "outsoleVariantId"=\'mercurial-elite-ag\' ORDER BY id LIMIT 1)');
   await db.query('UPDATE "CatalogueEntry" SET sample=false WHERE "outsoleVariantId"=\'mercurial-elite-ag\'');
   await db.query('INSERT INTO "RecommendationEvidence"(id,"variantId",kind,"sourceKind","sourceUrl","observedAt","validUntil",payload,approved,"updatedAt") SELECT \'perf35-evidence-\'||id,id,\'SURFACE\',\'MANUFACTURER\',\'https://www.nike.com/synthetic-benchmark-only\',now()-interval \'1 hour\',now()+interval \'1 day\',\'{"outsole":"AG","allowed":["AG"],"denied":[]}\'::jsonb,true,now() FROM "BootVariant" WHERE id LIKE \'perf35-variant-%\' OR id=\'mercurial-elite-ag\'');
   await db.query('INSERT INTO "User"(id,email,"emailVerified","updatedAt") SELECT \'perf35-user-\'||n,\'perf35-user-\'||n||\'@example.test\',now(),now() FROM generate_series(1,2000) n');
   await db.query('INSERT INTO "UserProfile"(id,"userId",username,"displayName","updatedAt") SELECT id,id,id,\'Synthetic benchmark reviewer\',now() FROM "User" WHERE id LIKE \'perf35-user-%\'');
   await db.query('INSERT INTO "BootReview"(id,"authorId","variantId","sizeWorn","sizeSystem","ownershipMonths","matchesPlayed",experience,pros,cons,comfort,fit,traction,"ballTouch",durability,value,"ratingTotal","shareFootInfo","analysisConsent","analysisConsentAt","updatedAt") SELECT id,id,\'mercurial-elite-ag\',\'9\',\'UK\',1,1,\'Synthetic bounded benchmark only; never real community content.\',\'Test pros\',\'Test cons\',3,3,3,3,3,3,18,true,true,now(),now() FROM "User" WHERE id LIKE \'perf35-user-%\'');
   scaled=true;
   await measure('recommendation-http-bounded-scale');
   const plan=await db.query('EXPLAIN (ANALYZE, FORMAT JSON) SELECT r.id FROM "BootReview" r JOIN "User" u ON u.id=r."authorId" WHERE r."variantId"=$1 AND r.status=\'PUBLISHED\' AND r."shareFootInfo" AND r."analysisConsent" AND r."analysisConsentAt" IS NOT NULL AND r.sponsorship IS NULL AND u.status=\'ACTIVE\' AND u."emailVerified" IS NOT NULL AND EXISTS(SELECT 1 FROM "UserProfile" p WHERE p."userId"=u.id) ORDER BY r.id LIMIT 2001',['mercurial-elite-ag']);
   const probe=plan.rows[0]['QUERY PLAN'][0];console.log(JSON.stringify({benchmark:'review-filter-sql-probe',executionMs:probe['Execution Time'],planningMs:probe['Planning Time'],rows:probe.Plan['Actual Rows'],scope:'Equivalent single-variant filter probe, not the exact Prisma-generated SQL or full request query count'}));
   assert.equal((await db.query('SELECT count(*)::int n FROM "FootProfile"')).rows[0].n,before);
   // Inject a real query failure only in this harness's disposable database, then restore immediately.
   await db.query('ALTER TABLE "RecommendationEvidence" RENAME TO "RecommendationEvidence_qa_unavailable"');
   try{
    const failed=await alice.request('/api/boot-fit/recommendations',{method:'POST',body:JSON.stringify({preferences:{surface:'AG'},processingConsent:true})});
    assert.equal(failed.status,503);assert.match(failed.headers.get('x-request-id')??'',/^[\da-f-]{36}$/);
    const text=await failed.text();assert.ok(!text.includes('Prisma'));assert.ok(!text.includes('RecommendationEvidence'));assert.match(failed.headers.get('cache-control')??'',/no-store/);
   }finally{await db.query('ALTER TABLE "RecommendationEvidence_qa_unavailable" RENAME TO "RecommendationEvidence"');}

   const unauthorized=await alice.request('/api/boot-fit/recommendations',{method:'POST',body:JSON.stringify({userId:'spoofed'})});assert.equal(unauthorized.status,400);assert.match(unauthorized.headers.get('x-request-id')??'',/^[\da-f-]{36}$/);
  }finally{
   await db.query('DELETE FROM "User" WHERE id LIKE \'perf35-user-%\'');
   await db.query('DELETE FROM "RecommendationEvidence" WHERE id LIKE \'perf35-evidence-%\'');
   await db.query('DELETE FROM "CatalogueEntry" WHERE id LIKE \'perf35-variant-%\'');
   await db.query('DELETE FROM "BootVariant" WHERE id LIKE \'perf35-variant-%\'');
   await db.query('UPDATE "CatalogueEntry" SET sample=true WHERE "outsoleVariantId"=\'mercurial-elite-ag\'');
   await clear();
  }
 });
}
