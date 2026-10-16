import assert from "node:assert/strict";
import type {TestContext} from "node:test";
import type pg from "pg";
type Browser={request(path:string,init?:RequestInit):Promise<Response>};
export async function recommendationTests(t:TestContext,{db,base,alice,bob,aliceId}:{db:pg.Client;base:string;alice:Browser;bob:Browser;aliceId:string}) {
 const path="/api/boot-fit/recommendations",foot="/api/account/foot-profile";
 const run=(browser:Browser,body:unknown={})=>browser.request(path,{method:"POST",body:JSON.stringify(body)});
 let profile:{version:number;revision:string};
 await t.test("recommendation API requires authentication, bounded valid input and private profile consent",async()=>{
  assert.equal((await fetch(base+path,{method:"POST",headers:{Origin:base},body:"{}"})).status,401);
  assert.equal((await fetch(base+path,{method:"POST",headers:{Origin:"https://attacker.invalid"},body:"{}"})).status,403);
  assert.equal((await run(alice,{userId:"other"})).status,400);
  assert.equal((await run(alice,{limit:10000})).status,400);
  assert.equal((await run(alice)).status,409);
  profile=(await (await alice.request(foot,{method:"PUT",body:JSON.stringify({version:0,leftLengthMm:"267.35",rightLengthMm:"270.1",surface:"AG",preferredBrands:["nike"]})})).json()).profile;
  assert.equal((await run(alice)).status,403);
  profile=(await (await alice.request(foot,{method:"PUT",body:JSON.stringify({version:profile.version,revision:profile.revision,leftLengthMm:"267.35",rightLengthMm:"270.1",surface:"AG",preferredBrands:["nike"],allowFitFinder:true})})).json()).profile;
 });
 await t.test("database sample catalogue produces no fabricated eligible products, scores, prices or inventory",async()=>{
  const response=await run(alice);assert.equal(response.status,200);assert.match(response.headers.get("cache-control")??"",/private.*no-store/);assert.ok(response.headers.get("vary")?.split(/,\s*/).includes("Cookie"));
  const text=await response.text();assert.ok(!text.includes("267.35"));assert.ok(!text.includes("270.1"));assert.ok(!text.includes('"userId"'));assert.ok(!text.includes('"revision"'));
  const data=JSON.parse(text);assert.equal(data.eligible.length,0);assert.ok(data.unverified.length>0);for(const r of data.unverified){assert.equal(r.sample,true);assert.equal(r.preferenceScore,null);assert.equal(r.price,null);assert.equal(r.availability,"unknown");assert.equal(r.surfaceStatus,"unknown");}
  const rows=await db.query('SELECT count(*)::int n FROM "BootVariant" b WHERE EXISTS (SELECT 1 FROM "CatalogueEntry" e WHERE e."outsoleVariantId"=b.id)');assert.equal(data.counts.evaluated,rows.rows[0].n);
 });
 await t.test("operator-approved exact-variant evidence changes eligibility without bleeding tiers or colorways",async()=>{
  const variant="mercurial-elite-ag";
  const entry=(await db.query('SELECT id FROM "CatalogueEntry" WHERE "outsoleVariantId"=$1 ORDER BY id LIMIT 1',[variant])).rows[0].id;
  await db.query('UPDATE "CatalogueEntry" SET sample=false WHERE id=$1',[entry]);
  const add=(id:string,kind:string,payload:unknown,approved=true)=>db.query('INSERT INTO "RecommendationEvidence"(id,"variantId",kind,"sourceKind","sourceUrl","observedAt","validUntil",payload,approved,"updatedAt") VALUES($1,$2,$3,$4,$5,now()-interval \'1 hour\',now()+interval \'1 day\',$6::jsonb,$7,now())',[id,variant,kind,"MANUFACTURER","https://www.nike.com/synthetic-integration-fixture-only",JSON.stringify(payload),approved]);
  try{
   await add("rec-surface","SURFACE",{outsole:"AG",allowed:["AG"],denied:["FG"]},false);
   assert.equal((await (await run(alice)).json()).eligible.length,0);
   await db.query('UPDATE "RecommendationEvidence" SET approved=true WHERE id=$1',["rec-surface"]);
   await add("rec-price","PRICE",{entryId:entry,amount:"120",currency:"AUD",size:null,sizeSystem:null});
   const data=await (await run(alice)).json();assert.equal(data.eligible.length,1);assert.equal(data.eligible[0].variantId,variant);assert.equal(data.eligible[0].tier,"Elite");assert.equal(data.eligible[0].outsole,"AG");assert.equal(data.eligible[0].price.entryId,entry);
   await add("rec-malformed","SURFACE",{outsole:"not-a-surface",allowed:["AG"]});
   const invalid=await (await run(alice)).json();assert.equal(invalid.eligible.length,0);assert.ok(invalid.notices.some((n:string)=>n.includes("Malformed")));
  }finally{await db.query('DELETE FROM "RecommendationEvidence" WHERE "variantId"=$1',[variant]);await db.query('UPDATE "CatalogueEntry" SET sample=true WHERE id=$1',[entry]);}
 });
 await t.test("recommendations do not grant consent, persist snapshots or permit another user to access a profile",async()=>{
  assert.equal((await run(bob,{userId:aliceId})).status,400);assert.equal((await run(bob)).status,409);
  const before=(await db.query('SELECT row_to_json(f)::text data FROM "FootProfile" f WHERE "userId"=$1',[aliceId])).rows[0].data;
  assert.equal((await run(alice,{limit:1})).status,200);
  assert.equal((await db.query('SELECT row_to_json(f)::text data FROM "FootProfile" f WHERE "userId"=$1',[aliceId])).rows[0].data,before);
  profile=(await (await alice.request(foot,{method:"PUT",body:JSON.stringify({version:profile.version,revision:profile.revision,allowFitFinder:false})})).json()).profile;
  assert.equal((await run(alice)).status,403);
  assert.equal((await alice.request(foot,{method:"DELETE",body:JSON.stringify(profile)})).status,400);
  assert.equal((await alice.request(foot,{method:"DELETE",body:JSON.stringify({version:profile.version,revision:profile.revision})})).status,200);
 });
 await t.test("recommendation requests enforce shared rate limits and body limits",async()=>{
  assert.equal((await bob.request(path,{method:"POST",body:JSON.stringify({extra:"x".repeat(33000)})})).status,413);
  let limited=false;for(let n=0;n<22;n++){const r=await run(bob);if(r.status===429){limited=true;assert.match(r.headers.get("cache-control")??"",/no-store/);break;}}assert.ok(limited);
 });
}
