import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import type pg from "pg";
import sharp from "sharp";
import { spawnSync } from "node:child_process";
import { S3Client,ListObjectsV2Command,DeleteBucketCommand,CreateBucketCommand } from "@aws-sdk/client-s3";
type Browser={request(path:string,init?:RequestInit):Promise<Response>};
export async function platformTests(t:TestContext,{db,base,alice,bob,aliceId,bobId,env}:{db:pg.Client;base:string;alice:Browser;bob:Browser;aliceId:string;bobId:string;env:NodeJS.ProcessEnv}){
 const write=(who:Browser,path:string,input:unknown,method="POST")=>who.request(path,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});
 const read=async(path:string)=>{const r=await fetch(base+path);assert.equal(r.status,200);return r.json();};
 const seed={specialization:"Disposable QA boot reviews",region:"Việt Nam",youtube:"https://www.youtube.com/@bootverse-qa-only",tiktok:null,instagram:null,website:"https://example.test/creator"};
 let creatorId="",postId="",reportId="",requestId="",profileId="",imageId="",videoId="";
 const postSlug="sprint25-disposable-qa";
 const image=await sharp({create:{width:30,height:20,channels:3,background:"blue"}}).jpeg().withMetadata({exif:{IFD0:{Artist:"Private disposable QA"}}}).toBuffer();
 const upload=(who:Browser,kind:string,id:string,body:Buffer=image)=>who.request(`/api/images?${new URLSearchParams({kind,id})}`,{method:"POST",headers:{"Content-Type":"image/jpeg"},body:new Uint8Array(body)});
 const backend=new S3Client({endpoint:env.S3_ENDPOINT,region:env.S3_REGION,forcePathStyle:true,credentials:{accessKeyId:env.S3_ACCESS_KEY_ID!,secretAccessKey:env.S3_SECRET_ACCESS_KEY!}});
 await t.test("platform: public empty directory, authentication, creator editing and Unicode handles",async()=>{
  assert.equal((await read("/api/creators")).total,0);
  assert.equal((await fetch(base+"/api/creators/me")).status,401);
  assert.equal((await write(alice,"/api/creators/me",{...seed,verificationStatus:"APPROVED"})).status,400);
  const created=await write(alice,"/api/creators/me",seed);assert.equal(created.status,200);creatorId=(await created.json()).creator.id;
  const mine=await (await alice.request("/api/creators/me")).json();assert.equal(mine.creator.region,"Việt Nam");
  assert.equal((await read("/api/creators?q=Disposable")).total,1);
  assert.equal((await read("/api/creators?specialization=missing")).total,0);
  assert.equal((await read("/api/creators?page=2")).creators.length,0);
  assert.equal((await write(alice,"/api/creators/me",{...seed,userId:bobId})).status,400);
  for(let i=0;i<13;i++) {
    const uid=`qa-creator-directory-${i}`;
    await db.query('INSERT INTO "User"(id,email,"emailVerified","updatedAt") VALUES ($1,$2,now(),now())',[uid,`${uid}@example.test`]);
    await db.query('INSERT INTO "UserProfile"(id,"userId",username,"displayName","updatedAt") VALUES ($1,$2,$3,$4,now())',[uid,uid,uid,`Disposable QA creator ${i}`]);
    await db.query('INSERT INTO "CreatorProfile"(id,"userId",specialization,"updatedAt") VALUES ($1,$1,$2,now())',[uid,"Disposable directory fixture"]);
  }
  assert.equal((await read("/api/creators")).creators.length,12);
  assert.equal((await read("/api/creators?page=2")).creators.length,2);
  assert.equal((await read("/api/creators?q=Disposable&specialization=Disposable%20directory%20fixture")).total,13);
  await db.query('DELETE FROM "User" WHERE id LIKE $1',["qa-creator-directory-%"]);
  const bobProfile=(await db.query('SELECT username FROM "UserProfile" WHERE "userId"=$1',[bobId])).rows[0];
  const unicode=await write(bob,"/api/account/profile",{username:"giày-đá-bóng",displayName:"Temporary QA",bio:"Disposable Unicode test"},"PATCH");assert.equal(unicode.status,200);
  const publicProfile=await fetch(base+"/users/"+encodeURIComponent("giày-đá-bóng"));assert.equal(publicProfile.status,200);
  await write(bob,"/api/account/profile",{username:bobProfile.username,displayName:"Bob QA",bio:""},"PATCH");
 });
 await t.test("platform: verification is admin-only, proof-backed, audited and revoked on link changes",async()=>{
  const applied=await write(alice,"/api/creators/me/verification",{});assert.equal(applied.status,200);const request=(await applied.json()).request;requestId=request.id;assert.ok(request.challenge.startsWith("bootverse-"));
  assert.equal((await (await write(alice,"/api/creators/me/verification",{})).json()).request.id,requestId);
  const approve={status:"APPROVED",note:"Disposable QA: checked the exact public profile challenge for this test.",ownershipConfirmed:true,proofUrl:seed.youtube};
  assert.equal((await write(alice,`/api/admin/verification/${requestId}`,approve)).status,403);
  await db.query('UPDATE "User" SET role=$1 WHERE id=$2',["MODERATOR",bobId]);
  assert.equal((await write(bob,`/api/admin/verification/${requestId}`,approve)).status,403);
  await db.query('UPDATE "User" SET role=$1 WHERE id=$2',["ADMIN",bobId]);
  try{
   assert.equal((await write(bob,`/api/admin/verification/${requestId}`,{...approve,ownershipConfirmed:false})).status,400);
   assert.equal((await write(bob,`/api/admin/verification/${requestId}`,{...approve,proofUrl:"https://www.youtube.com/@another"})).status,400);
   assert.equal((await write(bob,`/api/admin/verification/${requestId}`,approve)).status,200);
   assert.equal((await read("/api/creators")).creators[0].verificationStatus,"APPROVED");
   assert.equal((await db.query('SELECT count(*)::int AS n FROM "CreatorVerificationDecision" WHERE "requestId"=$1',[requestId])).rows[0].n,1);
   const username=(await read("/api/creators")).creators[0].user.profile.username;
   assert.ok((await (await fetch(base+`/creators/${username}`)).text()).includes("Verified Creator"));
   await write(alice,"/api/creators/me",{...seed,youtube:"https://www.youtube.com/@bootverse-qa-updated"});
   assert.equal((await read("/api/creators")).creators[0].verificationStatus,"UNVERIFIED");
   assert.equal((await db.query('SELECT count(*)::int AS n FROM "CreatorVerificationDecision" WHERE "requestId"=$1',[requestId])).rows[0].n,2);
   const reapplied=await write(alice,"/api/creators/me/verification",{});assert.equal(reapplied.status,200);const newId=(await reapplied.json()).request.id;
   assert.notEqual(newId,requestId);
   assert.equal((await write(bob,`/api/admin/verification/${newId}`,{...approve,status:"REJECTED",ownershipConfirmed:false,proofUrl:null})).status,200);
   assert.equal((await read("/api/creators")).creators[0].verificationStatus,"REJECTED");
   const audit=await (await bob.request("/api/admin")).json();assert.ok(audit.verificationHistory.some((h:{status:string})=>h.status==="REJECTED"));

  }finally{await db.query('UPDATE "User" SET role=$1 WHERE id=$2',["USER",bobId]);}
 });
 await db.query('INSERT INTO "Post" (id,slug,title,content,"authorId","categoryId","updatedAt",sponsorship) VALUES ($1,$2,$3,$4,$5,$6,now(),\'Disposable QA partnership\')',["qa-platform-post",postSlug,"Disposable platform QA post","Synthetic test content in a disposable database only.",aliceId,"questions"]);postId="qa-platform-post";
 assert.ok((await (await fetch(base+`/community/${postSlug}`)).text()).includes("Sponsored: "));
 profileId=(await db.query('SELECT id FROM "UserProfile" WHERE "userId"=$1',[aliceId])).rows[0].id;
 await t.test("platform: secure real S3 image upload, signature, size, quantity, quotas and ownership",async()=>{
  const anonymous=await fetch(base+`/api/images?kind=POST&id=${postId}`,{method:"POST",headers:{origin:base},body:new Uint8Array(image)});assert.equal(anonymous.status,401);
  assert.equal((await upload(bob,"POST",postId)).status,403);
  assert.equal((await upload(alice,"POST",postId,Buffer.from("<svg>unsafe</svg>"))).status,400);
  assert.equal((await upload(alice,"POST",postId,Buffer.alloc(1024*1024+1))).status,413);
  const created=await upload(alice,"POST",postId);assert.equal(created.status,201);imageId=(await created.json()).image.id;
  const bytes=await fetch(base+`/api/images/${imageId}`);assert.equal(bytes.status,200);assert.equal(bytes.headers.get("cache-control"),"private, no-store");
  const processed=await sharp(Buffer.from(await bytes.arrayBuffer())).metadata();assert.equal(processed.format,"webp");assert.equal(processed.exif,undefined);
  assert.equal((await bob.request(`/api/images/${imageId}`,{method:"DELETE"})).status,403);
  assert.equal((await upload(alice,"POST",postId)).status,201);
  assert.equal((await upload(alice,"POST",postId)).status,409);
  const avatar=await upload(alice,"AVATAR",profileId);assert.equal(avatar.status,201);
  assert.equal((await upload(alice,"AVATAR",profileId)).status,409);
  const original=(await db.query('SELECT bytes FROM "UploadedImage" WHERE id=$1',[imageId])).rows[0].bytes;
  await db.query('UPDATE "UploadedImage" SET bytes=$1 WHERE id=$2',[Number(env.UPLOAD_USER_QUOTA_BYTES),imageId]);
  assert.equal((await upload(alice,"COVER",creatorId)).status,409);
  await db.query('UPDATE "UploadedImage" SET bytes=$1 WHERE id=$2',[original,imageId]);
  assert.equal((await upload(alice,"COVER",creatorId)).status,201);
  const raw=await fetch(`${env.S3_ENDPOINT}/${env.S3_BUCKET}/${(await db.query('SELECT "objectKey" FROM "UploadedImage" WHERE id=$1',[imageId])).rows[0].objectKey}`);assert.equal(raw.status,403,"S3 bucket must not serve objects anonymously");
 });
 await t.test("platform: creator-owned video linking, provider validation and clear sponsorship",async()=>{
  const video={kind:"POST",id:postId,title:"Disposable QA video",url:"https://youtu.be/dQw4w9WgXcQ",sponsorship:"Disposable QA sponsor"};
  assert.equal((await write(bob,"/api/videos",video)).status,403);
  assert.equal((await write(alice,"/api/videos",{...video,url:"https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ"})).status,400);
  const r=await write(alice,"/api/videos",video);assert.equal(r.status,201);videoId=(await r.json()).video.id;
  assert.equal((await write(alice,"/api/videos",video)).status,409);
  const found=(await read(`/api/videos?kind=POST&id=${postId}`)).videos;assert.equal(found[0].videoId,"dQw4w9WgXcQ");assert.equal(found[0].sponsorship,video.sponsorship);
  assert.equal((await bob.request(`/api/videos/${videoId}`,{method:"DELETE"})).status,403);
 });
 await t.test("platform: reports deduplicate; moderators hide/restore with audit; regular users denied",async()=>{
  assert.equal((await fetch(base+"/api/admin")).status,401);
  assert.equal((await alice.request("/api/admin")).status,403);
  const report={kind:"POST",id:postId,reason:"spam",explanation:"Disposable QA report for moderation testing."};
  const first=await write(bob,"/api/reports",report);assert.equal(first.status,201);reportId=(await first.json()).report.id;
  assert.equal((await write(bob,"/api/reports",report)).status,200);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM "ContentReport" WHERE "targetKey"=$1',[`POST:${postId}`])).rows[0].n,1);
  const action={action:"HIDE",note:"Disposable QA: hide this synthetic post for testing."};
  assert.equal((await write(alice,`/api/admin/reports/${reportId}`,action)).status,403);
  await db.query('UPDATE "User" SET role=$1 WHERE id=$2',["MODERATOR",bobId]);
  try{
   assert.equal((await write(bob,`/api/admin/reports/${reportId}`,action)).status,200);
   assert.equal((await fetch(base+`/api/community/posts/${postSlug}`)).status,404);
   const unavailable = await fetch(base+`/api/images/${imageId}`); assert.equal(unavailable.status,404); assert.equal(unavailable.headers.get("cache-control"),"private, no-store");
   assert.equal((await fetch(base+`/api/videos?kind=POST&id=${postId}`)).status,404);
   const queue=await (await bob.request("/api/admin?status=ACTIONED&kind=POST")).json();assert.equal(queue.reports.length,1);assert.ok(queue.history.some((x:{targetKey:string})=>x.targetKey===`POST:${postId}`));assert.ok(!JSON.stringify(queue).includes("@example.test"));assert.ok(!JSON.stringify(queue).includes("footLengthCm"));
   assert.equal((await write(bob,`/api/admin/reports/${reportId}`,{...action,action:"RESTORE"})).status,200);
   assert.equal((await fetch(base+`/api/images/${imageId}`)).status,200);
   assert.equal((await write(bob,`/api/admin/reports/${reportId}`,{...action,action:"DISMISS"})).status,200);
   assert.equal((await db.query('SELECT count(*)::int AS n FROM "ModerationAction" WHERE "reportId"=$1',[reportId])).rows[0].n,3);
  }finally{await db.query('UPDATE "User" SET role=$1 WHERE id=$2',["USER",bobId]);}
 });
 await t.test("platform: comments, reviews, images and creator reports all support moderation",async()=>{
  await db.query('INSERT INTO "Comment"(id,"postId","authorId",content,"updatedAt") VALUES ($1,$2,$3,$4,now())',["qa-platform-comment",postId,aliceId,"Disposable moderation test comment"]);
  const review=await write(bob,"/api/reviews",{variantId:"mercurial-elite-fg",sizeWorn:"9",sizeSystem:"UK",ownershipMonths:2,matchesPlayed:5,experience:"Disposable QA review used only to verify moderation behavior.",pros:"Temporary QA pros",cons:"Temporary QA cons",comfort:4,fit:4,traction:4,ballTouch:4,durability:4,value:4});assert.equal(review.status,201);const reviewId=(await review.json()).review.id;
  assert.equal((await upload(bob,"REVIEW",reviewId)).status,201);
  for(const [kind,id] of [["COMMENT","qa-platform-comment"],["REVIEW",reviewId],["IMAGE",imageId],["CREATOR",creatorId]]){
   const r=await write(alice,"/api/reports",{kind,id,reason:"other",explanation:"Disposable QA report only."});assert.equal(r.status,201);const rid=(await r.json()).report.id;
   await db.query('UPDATE "User" SET role=$1 WHERE id=$2',["MODERATOR",bobId]);
   try{
    const a={action:"HIDE",note:"Disposable QA hide and restore validation."};assert.equal((await write(bob,`/api/admin/reports/${rid}`,a)).status,200);
    if(kind==="REVIEW")assert.equal((await fetch(base+`/api/reviews/${reviewId}`)).status,404);
    if(kind==="IMAGE")assert.equal((await fetch(base+`/api/images/${imageId}`)).status,404);
    if(kind==="CREATOR")assert.equal((await read("/api/creators")).total,0);
    if(kind==="COMMENT"){const thread=await read(`/api/community/posts/${postSlug}/comments`);assert.equal(thread.comments[0].content,null);assert.equal(thread.commentCount,0);}
    assert.equal((await write(bob,`/api/admin/reports/${rid}`,{...a,action:"RESTORE"})).status,200);
   }finally{await db.query('UPDATE "User" SET role=$1 WHERE id=$2',["USER",bobId]);}
  }
  await bob.request(`/api/reviews/${reviewId}`,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({version:3})});
 });
 await t.test("platform: image removal, parent cascades, durable S3 cleanup and storage failures",async()=>{
  const deletion=await alice.request(`/api/images/${imageId}`,{method:"DELETE"});assert.equal(deletion.status,204);assert.equal((await fetch(base+`/api/images/${imageId}`)).status,404);
  await db.query('DELETE FROM "Post" WHERE id=$1',[postId]);
  await db.query('DELETE FROM "UploadedImage" WHERE "ownerId" IN ($1,$2)',[aliceId,bobId]);
  assert.ok((await db.query('SELECT count(*)::int AS n FROM "StorageDeletion"')).rows[0].n>0);
  await db.query('UPDATE "StorageDeletion" SET "createdAt"=now()-interval \'2 hours\'');
  const cleanup=spawnSync(process.execPath,["--conditions=react-server","--import","tsx","scripts/cleanup-images.mts"],{env,encoding:"utf8"});assert.equal(cleanup.status,0,cleanup.stdout);assert.equal((await db.query('SELECT count(*)::int AS n FROM "StorageDeletion"')).rows[0].n,0);
  assert.equal((await backend.send(new ListObjectsV2Command({Bucket:env.S3_BUCKET}))).Contents?.length??0,0);
  assert.ok((await db.query('SELECT count(*)::int AS n FROM "ModerationAction" WHERE "targetKey"=$1',[`POST:${postId}`])).rows[0].n===3,"Audit history survives target/report deletion");
  await backend.send(new DeleteBucketCommand({Bucket:env.S3_BUCKET}));
  try{assert.equal((await upload(alice,"AVATAR",profileId)).status,503);assert.equal((await db.query('SELECT count(*)::int AS n FROM "UploadedImage"')).rows[0].n,0);}finally{await backend.send(new CreateBucketCommand({Bucket:env.S3_BUCKET}));}
 });
}
