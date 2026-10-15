import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import type pg from "pg";
type Browser={request(path:string,init?:RequestInit):Promise<Response>};
export async function footProfileTests(t:TestContext,{db,base,alice,bob,aliceId,bobId}:{db:pg.Client;base:string;alice:Browser;bob:Browser;aliceId:string;bobId:string}) {
  const endpoint="/api/account/foot-profile";
  const reviewsBefore=(await db.query('SELECT id,"footLengthCm","footWidthCm","footShape","shareFootInfo" FROM "BootReview" ORDER BY id')).rows;
  let version=0;
  let revision:string|null=null, bobRevision:string|null=null;
  await t.test("foot profiles deny anonymous access, CSRF, forged IDs and public lookup",async()=>{
    for(const method of ["GET","PUT","DELETE"]){const r=await fetch(base+endpoint,{method,headers:{Origin:base,"Content-Type":"application/json"},...(method!=="GET"?{body:JSON.stringify({version:0})}:{})});assert.equal(r.status,401);assert.match(r.headers.get("cache-control")??"",/private.*no-store/);}
    assert.equal((await alice.request(endpoint+"?userId="+bobId)).status,400);
    assert.equal((await alice.request(endpoint,{method:"PUT",body:JSON.stringify({version:0,userId:bobId})})).status,400);
    assert.equal((await fetch(base+endpoint,{method:"PUT",headers:{Origin:"https://attacker.invalid"},body:JSON.stringify({version:0})})).status,403);
    assert.equal((await alice.request(endpoint+"/"+bobId)).status,404);
  });
  await t.test("foot profile persists exact independent measurements, consent and optional preferences",async()=>{
    const initial=await alice.request(endpoint);assert.equal(initial.status,200);assert.equal((await initial.json()).profile,null);
    const r=await alice.request(endpoint,{method:"PUT",body:JSON.stringify({version:0,unit:"cm",leftLengthMm:"26.735",rightLengthMm:"27.01",leftWidthMm:"9.123",measuredOn:"2025-10-01",footShape:"Unsure",primaryPosition:"MID",secondaryPositions:["DEF"],surface:"IN",budgetAmount:"125.50",currency:"USD",preferredBrands:["nike"],preferredTiers:["Elite"],allowFitFinder:true})});
    assert.equal(r.status,200);const {profile}=await r.json();version=profile.version;revision=profile.revision;assert.equal(profile.leftLengthMm,"267.35");assert.equal(profile.rightLengthMm,"270.1");assert.equal(profile.rightWidthMm,null);assert.equal(profile.unit,"mm");assert.ok(profile.fitFinderConsentAt);assert.equal(profile.measuredOn,"2025-10-01");assert.ok(!("userId"in profile));
    const row=(await db.query('SELECT "leftLengthMm"::text, "leftWidthMm"::text, "rightWidthMm", "allowFitFinder" FROM "FootProfile" WHERE "userId"=$1',[aliceId])).rows[0];assert.equal(row.leftLengthMm,"267.35");assert.equal(row.leftWidthMm,"91.23");assert.equal(row.rightWidthMm,null);
    const refreshed=await alice.request(endpoint);assert.match(refreshed.headers.get("cache-control")??"",/private.*no-store/);assert.equal((await refreshed.json()).profile.leftLengthMm,"267.35");
    assert.equal((await alice.request("/profile/foot-profile")).status,200);
  });
  await t.test("database enforces profile uniqueness, foreign keys and numeric limits",async()=>{
    await assert.rejects(db.query('INSERT INTO "FootProfile"(id,"userId","updatedAt") VALUES($1,$2,now())',["duplicate-foot",aliceId]),(e:unknown)=>(e as {code:string}).code==="23505");
    await assert.rejects(db.query('INSERT INTO "FootProfile"(id,"userId","updatedAt") VALUES($1,$2,now())',["missing-owner-foot","missing-foot-owner"]),(e:unknown)=>(e as {code:string}).code==="23503");
    await assert.rejects(db.query('UPDATE "FootProfile" SET "leftLengthMm"=-1 WHERE "userId"=$1',[aliceId]),(e:unknown)=>(e as {code:string}).code==="23514");
  });
  await t.test("other users cannot read, mutate or delete an owner's foot profile",async()=>{
    assert.equal((await (await bob.request(endpoint)).json()).profile,null);
    assert.equal((await bob.request(endpoint,{method:"PUT",body:JSON.stringify({version,userId:aliceId,leftLengthMm:"250"})})).status,400);
    assert.equal((await bob.request(endpoint,{method:"DELETE",body:JSON.stringify({version,userId:aliceId})})).status,400);
    const own=await bob.request(endpoint,{method:"PUT",body:JSON.stringify({version:0})});assert.equal(own.status,200);const blank=(await own.json()).profile;bobRevision=blank.revision;assert.equal(blank.leftLengthMm,null);assert.equal(blank.allowFitFinder,false);assert.equal(blank.fitFinderConsentAt,null);
    assert.equal((await (await alice.request(endpoint)).json()).profile.leftLengthMm,"267.35");
    const username=(await db.query('SELECT username FROM "UserProfile" WHERE "userId"=$1',[aliceId])).rows[0].username;
    for(const path of ["/api/users/"+username,"/users/"+username,"/api/creators","/api/community","/api/reviews"]){const r=await fetch(base+path);const body=await r.text();assert.ok(!body.includes("267.35"),path);assert.ok(!body.includes('"leftLengthMm"'),path);}
  });
  await t.test("foot profile updates revoke consent, reject invalid input and detect concurrent edits",async()=>{
    for(const x of [{leftLengthMm:"400.001"},{unit:"inch"},{leftWidthMm:"0"},{budgetAmount:"12",currency:"FAK"},{measuredOn:"2026-02-30"}])assert.equal((await alice.request(endpoint,{method:"PUT",body:JSON.stringify({version,revision,...x})})).status,400);
    const responses=await Promise.all(["268.25","268.50"].map(leftLengthMm=>alice.request(endpoint,{method:"PUT",body:JSON.stringify({version,revision,leftLengthMm})})));
    assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
    const p=(await (await alice.request(endpoint)).json()).profile;version=p.version;assert.equal(p.allowFitFinder,false);assert.equal(p.fitFinderConsentAt,null);assert.equal(p.budgetAmount,null);
    assert.equal((await alice.request(endpoint,{method:"DELETE",body:JSON.stringify({version:1,revision})})).status,409);
  });
  await t.test("foot profile deletion removes only current profile and preserves review snapshots",async()=>{
    assert.equal((await alice.request(endpoint,{method:"DELETE",body:JSON.stringify({version,revision})})).status,200);
    assert.equal((await (await alice.request(endpoint)).json()).profile,null);
    assert.equal((await db.query('SELECT count(*)::int n FROM "FootProfile" WHERE "userId"=$1',[aliceId])).rows[0].n,0);
    assert.equal((await db.query('SELECT count(*)::int n FROM "FootProfile" WHERE "userId"=$1',[bobId])).rows[0].n,1);
    assert.deepEqual((await db.query('SELECT id,"footLengthCm","footWidthCm","footShape","shareFootInfo" FROM "BootReview" ORDER BY id')).rows,reviewsBefore);
    assert.equal((await bob.request(endpoint,{method:"DELETE",body:JSON.stringify({version:1,revision:bobRevision})})).status,200);
  });
  await t.test("stale tabs cannot modify a profile recreated after deletion",async()=>{
    const request=(method:string,body:unknown)=>alice.request(endpoint,{method,body:JSON.stringify(body)});
    const first=(await (await request("PUT",{version:0,leftLengthMm:"250"})).json()).profile;
    assert.equal((await request("DELETE",{version:first.version,revision:first.revision})).status,200);
    const second=(await (await request("PUT",{version:0,leftLengthMm:"260"})).json()).profile;
    assert.equal((await request("PUT",{version:first.version,revision:first.revision,leftLengthMm:"251"})).status,409);
    assert.equal((await request("DELETE",{version:first.version,revision:first.revision})).status,409);
    assert.equal((await (await alice.request(endpoint)).json()).profile.leftLengthMm,"260");
    assert.equal((await request("DELETE",{version:second.version,revision:second.revision})).status,200);
  });

}
