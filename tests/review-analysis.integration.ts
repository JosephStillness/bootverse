import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import type {TestContext} from 'node:test';
import type pg from 'pg';
type Browser={request(path:string,init?:RequestInit):Promise<Response>};
export async function reviewAnalysisTests(t:TestContext,{db,alice,bob,aliceId,bobId,secret}:{db:pg.Client;alice:Browser;bob:Browser;aliceId:string;bobId:string;secret:string}) {
 const variant='mercurial-elite-ag',prefix='fit-analysis-test-';
 const write=(b:Browser,path:string,method:string,input:unknown)=>b.request(path,{method,body:JSON.stringify(input)});
 const run=async()=>{const r=await write(alice,'/api/boot-fit/recommendations','POST',{});assert.equal(r.status,200);return r.json();};
 const analysis=async()=>{const data=await run();return [...data.eligible,...data.unverified].find(r=>r.variantId===variant).reviewAnalysis;};
 const fixture={variantId:variant,sizeWorn:'9',sizeSystem:'UK',ownershipMonths:2,matchesPlayed:10,experience:'Synthetic review fixture only in a disposable test database.',pros:'Test observations',cons:'Test limitations',comfort:5,fit:4,traction:3,ballTouch:3,durability:3,value:3,footLengthCm:27,footWidthCm:10,footShape:'average',shareFootInfo:true,widthObservation:'expected',toeRoomCategory:'expected',heelLockdownCategory:'secure',breakInCategory:'none'};
 let profile:{version:number;revision:string}|undefined,reviewId='',version=1;
 // Reset only review mutation buckets consumed by earlier suites; preserve auth/security rate-limit evidence.
 for(const userId of [aliceId,bobId])for(const [scope,seconds] of [['reviews:create',900],['reviews:changes',60]] as const){
  const key=createHmac('sha256',secret).update(`${scope}:${userId}:${Math.floor(Date.now()/(seconds*1000))}`).digest('hex');
  await db.query('DELETE FROM "RateLimit" WHERE key=$1',[key]);
 }
 try {
  await t.test('fit analysis: explicit analytical consent is separate, server timestamped and owner-only',async()=>{
   assert.equal((await write(bob,'/api/reviews','POST',{...fixture,analysisConsent:true,shareFootInfo:false})).status,400);
   const created=await write(bob,'/api/reviews','POST',fixture);assert.equal(created.status,201);reviewId=(await created.json()).review.id;
   let row=(await db.query('SELECT "analysisConsent","analysisConsentAt" FROM "BootReview" WHERE id=$1',[reviewId])).rows[0];assert.equal(row.analysisConsent,false);assert.equal(row.analysisConsentAt,null);
   assert.equal((await write(alice,`/api/reviews/${reviewId}`,'PATCH',{...fixture,analysisConsent:true,version})).status,403);
   assert.equal((await write(bob,`/api/reviews/${reviewId}`,'PATCH',{...fixture,analysisConsent:true,analysisConsentAt:'2026-10-16',version})).status,400);
   assert.equal((await write(bob,`/api/reviews/${reviewId}`,'PATCH',{...fixture,analysisConsent:true,version})).status,200);version++;
   row=(await db.query('SELECT "analysisConsent","analysisConsentAt" FROM "BootReview" WHERE id=$1',[reviewId])).rows[0];assert.equal(row.analysisConsent,true);assert.ok(row.analysisConsentAt instanceof Date);
   await assert.rejects(db.query('UPDATE "BootReview" SET "shareFootInfo"=false WHERE id=$1',[reviewId]),/check constraint/);
  });
  await t.test('fit analysis: exact persisted cohorts, privacy and recommendation safety',async()=>{
   const r=await write(alice,'/api/account/foot-profile','PUT',{version:0,leftLengthMm:'270',rightLengthMm:'269',leftWidthMm:'100',rightWidthMm:'99',footShape:'Regular',sizeSystem:'UK',sizeWorn:'9',surface:'AG',allowFitFinder:true});assert.equal(r.status,200);profile=(await r.json()).profile;
   assert.equal((await analysis()).counts.eligible,null,'Sample product analysis must be withheld');
   await db.query('UPDATE "CatalogueEntry" SET sample=false WHERE "outsoleVariantId"=$1',[variant]);
   for(let n=0;n<10;n++){
    const id=prefix+n;
    await db.query('INSERT INTO "User"(id,email,"emailVerified","updatedAt") VALUES($1,$2,now(),now())',[id,id+'@example.test']);
    await db.query('INSERT INTO "UserProfile"(id,"userId",username,"displayName","updatedAt") VALUES($1::text,$1::text,$1::varchar,$2,now())',[id,'Isolated fit analysis fixture']);
    await db.query('INSERT INTO "BootReview"(id,"authorId","variantId","sizeWorn","sizeSystem","ownershipMonths","matchesPlayed",experience,pros,cons,comfort,fit,traction,"ballTouch",durability,value,"ratingTotal","footLengthCm","footWidthCm","footShape","shareFootInfo","analysisConsent","analysisConsentAt","widthObservation","toeRoomCategory","heelLockdownCategory","breakInCategory","updatedAt") VALUES($1,$1,$2,\'9.0\',\'UK\',1,1,$3,\'Test pros\',\'Test cons\',5,4,3,3,3,3,21,$4,10,\'average\',true,true,now(),\'expected\',\'expected\',\'secure\',\'none\',now())',[id,variant,fixture.experience,n<5?27:30]);
   }
   await db.query('INSERT INTO "BootReview"(id,"authorId","variantId","sizeWorn","sizeSystem","ownershipMonths","matchesPlayed",experience,pros,cons,comfort,fit,traction,"ballTouch",durability,value,"ratingTotal","footLengthCm","footWidthCm","shareFootInfo","analysisConsent","analysisConsentAt","updatedAt") VALUES($1,$2,$3,\'9\',\'UK\',1,1,$4,\'Test pros\',\'Test cons\',3,3,3,3,3,3,18,27,10,true,true,now(),now())',[prefix+'viewer-own',aliceId,variant,fixture.experience]);
   const data=await run(),candidate=data.unverified.find((r:{variantId:string})=>r.variantId===variant),a=candidate.reviewAnalysis;
   assert.equal(a.counts.eligible,11);assert.equal(a.counts.similar,6);assert.equal(a.similar.fitMean,4);assert.equal(a.similar.comfortMean,5);assert.equal(a.similar.fitDistribution['4'],6);assert.equal(a.similarity.meanScore,100);assert.equal(candidate.surfaceStatus,'unknown');assert.equal(candidate.physicalFit,'unknown');assert.equal(candidate.preferenceScore,null);
   const serialized=JSON.stringify(a);for(const forbidden of ['authorId','footLengthCm','footWidthCm','analysisConsentAt','leftLengthMm',prefix,reviewId])assert.ok(!serialized.includes(forbidden));
   // Each variant stays separate, even when the brand and family match.
   const other=data.unverified.find((r:{variantId:string})=>r.variantId==='mercurial-elite-fg');assert.equal(other.reviewAnalysis.overall,null);
   await db.query('INSERT INTO "RecommendationEvidence"(id,"variantId",kind,"sourceKind","sourceUrl","observedAt","validUntil",payload,approved,"updatedAt") VALUES($1,$2,\'SURFACE\',\'MANUFACTURER\',\'https://www.nike.com/synthetic-test-only\',now()-interval \'1 hour\',now()+interval \'1 day\',$3::jsonb,true,now())',[prefix+'denial',variant,JSON.stringify({outsole:'AG',allowed:[],denied:['AG']})]);
   const denied=await run();assert.equal(denied.counts.excluded,1);assert.ok(![...denied.eligible,...denied.unverified].some(r=>r.variantId===variant),'Reviews cannot override a manufacturer surface denial');
   await db.query('DELETE FROM "RecommendationEvidence" WHERE id=$1',[prefix+'denial']);
  });
  await t.test('fit analysis: consent withdrawal, moderation, suspension, size scope and deletion take effect immediately',async()=>{
   assert.equal((await write(bob,`/api/reviews/${reviewId}`,'PATCH',{...fixture,analysisConsent:false,version})).status,200);version++;
   let a=await analysis();assert.deepEqual(a.counts,{eligible:10,similar:5});
   assert.equal((await db.query('SELECT "analysisConsentAt" FROM "BootReview" WHERE id=$1',[reviewId])).rows[0].analysisConsentAt,null);
   for(const sql of ['UPDATE "BootReview" SET status=\'HIDDEN\' WHERE id=$1','UPDATE "User" SET status=\'SUSPENDED\' WHERE id=$1','UPDATE "BootReview" SET "sizeSystem"=\'US\' WHERE id=$1']){
    await db.query(sql,[prefix+'0']);a=await analysis();assert.equal(a.counts.similar,null);assert.equal(a.similar,null);
    await db.query('UPDATE "BootReview" SET status=\'PUBLISHED\',"sizeSystem"=\'UK\' WHERE id=$1',[prefix+'0']);await db.query('UPDATE "User" SET status=\'ACTIVE\' WHERE id=$1',[prefix+'0']);
   }
   await db.query('DELETE FROM "User" WHERE id=$1',[prefix+'0']);assert.equal((await analysis()).similar,null);
   assert.equal((await write(bob,`/api/reviews/${reviewId}`,'DELETE',{version})).status,204);reviewId='';
  });
  await t.test('fit analysis: bounded scan fails closed instead of publishing partial aggregate counts',async()=>{
   await db.query('INSERT INTO "User"(id,email,"emailVerified","updatedAt") SELECT $1||n,$1||n||\'@example.test\',now(),now() FROM generate_series(100,2100) n',[prefix]);
   await db.query('INSERT INTO "UserProfile"(id,"userId",username,"displayName","updatedAt") SELECT id,id,id,\'Isolated overflow fixture\',now() FROM "User" WHERE id LIKE $1 AND NOT EXISTS(SELECT 1 FROM "UserProfile" p WHERE p."userId"="User".id)',[prefix+'%']);
   await db.query('INSERT INTO "BootReview"(id,"authorId","variantId","sizeWorn","sizeSystem","ownershipMonths","matchesPlayed",experience,pros,cons,comfort,fit,traction,"ballTouch",durability,value,"ratingTotal","shareFootInfo","analysisConsent","analysisConsentAt","updatedAt") SELECT u.id,u.id,$2,\'9\',\'UK\',1,1,$3,\'Test pros\',\'Test cons\',3,3,3,3,3,3,18,true,true,now(),now() FROM "User" u WHERE u.id LIKE $1 AND NOT EXISTS(SELECT 1 FROM "BootReview" r WHERE r."authorId"=u.id)',[prefix+'%',variant,fixture.experience]);
   const a=await analysis();assert.equal(a.counts.eligible,null);assert.equal(a.overall,null);assert.ok(a.warnings.some((s:string)=>s.includes('scan limit')));
  });
 }finally{
  await db.query('DELETE FROM "RecommendationEvidence" WHERE id=$1',[prefix+'denial']);
  await db.query('DELETE FROM "BootReview" WHERE id=$1',[prefix+'viewer-own']);
  if(reviewId)await db.query('DELETE FROM "BootReview" WHERE id=$1',[reviewId]);
  await db.query('DELETE FROM "User" WHERE id LIKE $1',[prefix+'%']);
  await db.query('UPDATE "CatalogueEntry" SET sample=true WHERE "outsoleVariantId"=$1',[variant]);
  if(profile)await write(alice,'/api/account/foot-profile','DELETE',{version:profile.version,revision:profile.revision});
 }
}
