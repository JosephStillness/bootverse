import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import type {TestContext} from 'node:test';
import type pg from 'pg';
import {saveFinderPayload,type FinderValues} from '../src/lib/recommendations/finder';
import type {PrivateFootProfile} from '../src/lib/foot-profile/service';
type Browser={request(path:string,init?:RequestInit):Promise<Response>};
export async function finderTests(t:TestContext,{db,base,alice,bob,aliceId,bobId,secret}:{db:pg.Client;base:string;alice:Browser;bob:Browser;aliceId:string;bobId:string;secret:string}) {
 const path='/api/boot-fit/recommendations',foot='/api/account/foot-profile';
 const preferences:FinderValues={unit:'cm' as const,leftLengthMm:'26.8',rightLengthMm:'27',leftWidthMm:'10',rightWidthMm:'9.9',footShape:'Regular',instep:null,fitSensation:null,snugness:null,primaryPosition:'MID',surface:'AG' as const,budgetAmount:'100',currency:'AUD',preferredBrands:['nike'],preferredTiers:['Elite'],sizeWorn:'9',sizeSystem:'UK'};
 const input={preferences,processingConsent:true,limit:20};
 const write=(browser:Browser,url:string,method:string,body:unknown)=>browser.request(url,{method,body:JSON.stringify(body)});
 const run=(body:unknown=input)=>write(alice,path,'POST',body);
 let stored:PrivateFootProfile|null=null;
 // Preserve the auth/security buckets tested elsewhere; reset only this suite's explicit request scopes.
 for(const userId of [aliceId,bobId])for(const scope of ['recommendations:run','foot-profile:change']){const key=createHmac('sha256',secret).update(`${scope}:${userId}:${Math.floor(Date.now()/900000)}`).digest('hex');await db.query('DELETE FROM "RateLimit" WHERE key=$1',[key]);}
 try{
  await t.test('finder: public guest guidance, protected transient mode and strict consent payload',async()=>{
   const page=await fetch(base+'/boot-fit-finder');assert.equal(page.status,200);const html=await page.text();assert.ok(html.includes('Guest recommendation queries are not supported'));assert.ok(html.includes('Boot Fit Finder'));assert.ok(!html.includes('name="leftLengthMm"'));
   assert.equal((await fetch(base+path,{method:'POST',headers:{origin:base},body:JSON.stringify(input)})).status,401);
   assert.equal((await fetch(base+path,{method:'POST',headers:{origin:'https://attacker.invalid'},body:JSON.stringify(input)})).status,403);
   assert.equal((await run({preferences})).status,400);
   assert.equal((await run({...input,userId:bobId})).status,400);
   assert.equal((await run({...input,preferences:{...preferences,userId:bobId}})).status,400);
   assert.equal((await run({...input,preferences:{...preferences,surface:null}})).status,400);
   assert.equal((await run({...input,preferences:{...preferences,leftLengthMm:'script'}})).status,400);
   assert.equal((await run({...input,saveProfile:true})).status,400);
  });
  await t.test('finder: transient recommendations work without a saved profile and do not fabricate or persist data',async()=>{
   const r=await run();assert.equal(r.status,200);assert.match(r.headers.get('cache-control')??'',/private.*no-store/);const text=await r.text();assert.ok(!text.includes('26.8'));assert.ok(!text.includes('268'));assert.ok(!text.includes('"userId"'));const data=JSON.parse(text);assert.equal(data.eligible.length,0);assert.ok(data.unverified.length>0);for(const result of data.unverified){assert.equal(result.sample,true);assert.equal(result.preferenceScore,null);assert.equal(result.price,null);assert.ok(result.brand);assert.ok(result.generation);assert.ok(result.reviewAnalysis);}
   assert.equal((await db.query('SELECT count(*)::int n FROM "FootProfile" WHERE "userId"=$1',[aliceId])).rows[0].n,0);
   assert.equal((await (await alice.request(foot)).json()).profile,null);
  });
  await t.test('finder: own-profile preload, explicit save, unrelated fields and optimistic concurrency remain intact',async()=>{
   const created=await write(alice,foot,'PUT',{version:0,leftLengthMm:'250',rightLengthMm:'249',leftWidthMm:'90',rightWidthMm:'89',arch:'High',measuredOn:'2026-01-01',measurementMethod:'Previous standing method',allowFitFinder:false});assert.equal(created.status,200);stored=(await created.json()).profile;
   const own=await alice.request(foot);assert.equal(own.status,200);assert.equal((await own.json()).profile.arch,'High');assert.equal((await bob.request(foot+'?userId='+aliceId)).status,400);assert.equal((await (await bob.request(foot)).json()).profile,null);
   const before=(await db.query('SELECT row_to_json(f)::text data FROM "FootProfile" f WHERE "userId"=$1',[aliceId])).rows[0].data;
   assert.equal((await run({limit:1})).status,403);assert.equal((await run()).status,200);assert.equal((await db.query('SELECT row_to_json(f)::text data FROM "FootProfile" f WHERE "userId"=$1',[aliceId])).rows[0].data,before);
   const payload=saveFinderPayload(preferences,stored);const saved=await write(alice,foot,'PUT',payload);assert.equal(saved.status,200);stored=(await saved.json()).profile;
   assert.ok(stored);assert.equal(stored.leftLengthMm,'268');assert.equal(stored.rightLengthMm,'270');assert.equal(stored.arch,'High');assert.equal(stored.measurementMethod,null);assert.equal(stored.measuredOn,null);assert.equal(stored.allowFitFinder,true);assert.equal(stored.version,2);
   assert.equal((await write(alice,foot,'PUT',payload)).status,409);assert.equal((await run({limit:1})).status,200);
  });
  await t.test('finder: transient output preserves exact variants and surface-denial precedence',async()=>{
   const variant='mercurial-elite-ag';await db.query('UPDATE "CatalogueEntry" SET sample=false WHERE "outsoleVariantId"=$1',[variant]);
   await db.query('INSERT INTO "RecommendationEvidence"(id,"variantId",kind,"sourceKind","sourceUrl","observedAt","validUntil",payload,approved,"updatedAt") VALUES(\'finder-test-surface\',$1,\'SURFACE\',\'MANUFACTURER\',\'https://www.nike.com/isolated-finder-test\',now()-interval \'1 hour\',now()+interval \'1 day\',$2::jsonb,true,now())',[variant,JSON.stringify({outsole:'AG',allowed:['AG'],denied:['FG']})]);
   const data=await (await run()).json();assert.equal(data.eligible.length,1);assert.equal(data.eligible[0].variantId,variant);assert.equal(data.eligible[0].brandId,'nike');assert.equal(data.eligible[0].tier,'Elite');assert.equal(data.eligible[0].outsole,'AG');assert.equal(data.eligible[0].physicalFit,'unknown');
   const denied=await (await run({...input,preferences:{...preferences,surface:'FG'}})).json();assert.equal(denied.counts.excluded,1);assert.ok(![...denied.eligible,...denied.unverified].some(r=>r.variantId===variant));
  });
 }finally{
  await db.query('DELETE FROM "RecommendationEvidence" WHERE id=\'finder-test-surface\'');await db.query('UPDATE "CatalogueEntry" SET sample=true WHERE "outsoleVariantId"=\'mercurial-elite-ag\'');
  const remaining=(await db.query('SELECT id,version FROM "FootProfile" WHERE "userId"=$1',[aliceId])).rows[0];
  if(remaining)await write(alice,foot,'DELETE',{version:remaining.version,revision:remaining.id});
 }
}
