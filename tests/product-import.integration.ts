import assert from 'node:assert/strict';
import type {TestContext} from 'node:test';
import type pg from 'pg';
import {randomUUID} from 'node:crypto';
import {prepareImport,emptyGraph} from '../src/lib/data-import/preview';
type Browser={request(path:string,init?:RequestInit):Promise<Response>};
export async function productImportTests(t:TestContext,{db,base,alice,bob,aliceId,bobId}:{db:pg.Client;base:string;alice:Browser;bob:Browser;aliceId:string;bobId:string}){
 assert.match((await db.query('SELECT current_database() name')).rows[0].name,/^bootverse_auth_test_/);
 const oldRole=(await db.query('SELECT role FROM "User" WHERE id=$1',[aliceId])).rows[0].role;
 const sourceId='synthetic-d2-source';let firstBatch='',firstTicket='',firstInput:ReturnType<typeof input>,entryId='';
 const observedAt=new Date(Date.now()-60000).toISOString();
 const product=(n:number,extra:Record<string,unknown>={})=>({recordId:'synthetic-d2-'+n,brand:'Synthetic D2 brand',family:'Synthetic D2 family',generation:'Synthetic D2 generation',tier:'Elite',outsole:'FG',colorway:'Synthetic blue',sku:'SYNTHETIC-D2-'+n,sourceUrl:'https://example.test/d2/'+n,observedAt,...extra});
 function input(products:unknown[],source=sourceId){return {sourceId:source,format:'JSON' as const,content:JSON.stringify({version:1,products}),mapping:{}};}
 let importBrowser=alice;
 const post=(path:string,data:unknown,browser=importBrowser)=>browser.request(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
 const preview=async(data:ReturnType<typeof input>)=>{const r=await post('/api/admin/product-imports/preview',data);assert.equal(r.status,200,await r.clone().text());return r.json();};
 const execute=(data:ReturnType<typeof input>,ticket:string,key:string=randomUUID())=>post('/api/admin/product-imports',{...data,ticket,idempotencyKey:key,confirmed:true});
 const count=async(table:string)=>(await db.query(`SELECT count(*)::int n FROM "${table}"`)).rows[0].n;
 const footprint=async()=>{const result:Record<string,string>={};for(const {tablename} of (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows){const name=String(tablename).replaceAll('"','""');result[tablename]=(await db.query(`SELECT md5(coalesce(string_agg(row_to_json(t)::text,E'\\n' ORDER BY row_to_json(t)::text),'')) hash FROM "${name}" t`)).rows[0].hash;}return result;};
 try{
  await db.query(`UPDATE "User" SET role='ADMIN' WHERE id=$1`,[aliceId]);
  await db.query(`INSERT INTO "ProductSource"(id,name,type,"baseUrl","accessMethod","authorizationStatus","permissionNotes","permissionUrl","authorizationCheckedAt","updatedAt") VALUES($1,'Synthetic D2 authorized fixture','RETAILER','https://example.test','Synthetic fixture only','NOT_REQUIRED','Synthetic test-only access attestation','https://example.test/fixture-policy',now(),now())`,[sourceId]);
  await t.test('D2 import APIs require active admin, same origin and documented source access',async()=>{
   const body=input([product(0)]);for(const path of ['/api/admin/product-imports/preview','/api/admin/product-imports']){assert.equal((await fetch(base+path,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)})).status,401);assert.equal((await post(path,body,bob)).status,403);}
   assert.equal((await alice.request('/api/admin/product-imports/preview',{method:'POST',headers:{Origin:'https://evil.example.test','Content-Type':'application/json'},body:JSON.stringify(body)})).status,403);
   assert.equal((await post('/api/admin/product-imports/preview',{...body,sourceId:'missing'})).status,400);
   assert.equal((await execute(body,'forged-preview')).status,400);
  });
  await t.test('D2 dry-run changes no PostgreSQL table, even when Auth.js would refresh a session',async()=>{
   const sessions=(await db.query('SELECT id,expires FROM "Session" WHERE "userId"=$1',[aliceId])).rows;
   await db.query(`UPDATE "Session" SET expires=now()+interval '2 days' WHERE "userId"=$1`,[aliceId]);
   try{firstInput=input([product(1,{specifications:[{attribute:'upperMaterial',value:'Synthetic original upper',basis:'REPORTED'}],images:[{externalUrl:'https://example.test/synthetic.webp',sourceUrl:'https://example.test/photo',attribution:'Synthetic fixture owner',altText:'Synthetic image metadata only',licenseStatus:'UNKNOWN'}],offers:[{sourceUrl:'https://example.test/offer',amount:'100',currency:'AUD',countryCode:'AU',size:'9',sizeSystem:'UK',available:true,observedAt,validUntil:new Date(Date.now()+86400000).toISOString()}]}),product(2)]);const before=await footprint();const a=await preview(firstInput),b=await preview(firstInput);assert.deepEqual(a.summary,b.summary);assert.deepEqual(a.rows,b.rows);assert.deepEqual(await footprint(),before);assert.equal(a.summary.newRecords,2);firstTicket=a.ticket;
   }finally{for(const s of sessions)await db.query('UPDATE "Session" SET expires=$1 WHERE id=$2',[s.expires,s.id]);}
  });
  await t.test('D2 malformed/oversized/unsafe input and missing identity never get an executable preview',async()=>{
   const invalid=[{...input([]),content:'{broken'},input([{...product(0),sourceUrl:'http://169.254.169.254/latest'}]),input([{...product(0),published:true}]),input([{...product(0),specifications:[{attribute:'weight',value:200,basis:'MEASURED'}]}])];
   for(const data of invalid){const r=await post('/api/admin/product-imports/preview',data);if(r.status===200){const d=await r.json();assert.equal(d.ready,false);assert.equal(d.ticket,null);}else assert.equal(r.status,400);}
   const incomplete=await preview(input([{recordId:'missing'}]));assert.equal(incomplete.rows[0].outcome,'INSUFFICIENT_IDENTITY');assert.equal(incomplete.ready,false);
   const oversized={...input([]),format:'CSV',content:'x'.repeat(10*1024*1024+1)};assert.equal((await post('/api/admin/product-imports/preview',oversized)).status,400);
  });
  await t.test('D2 preview rejects expired sessions without deleting or refreshing them',async()=>{
   const sessions=(await db.query('SELECT id,expires FROM "Session" WHERE "userId"=$1',[bobId])).rows;
   await db.query(`UPDATE "Session" SET expires=now()-interval '1 day' WHERE "userId"=$1`,[bobId]);
   try{const before=await footprint();assert.equal((await post('/api/admin/product-imports/preview',input([product(0)]),bob)).status,401);assert.deepEqual(await footprint(),before);}finally{for(const s of sessions)await db.query('UPDATE "Session" SET expires=$1 WHERE id=$2',[s.expires,s.id]);}
  });
  await t.test('D2 atomic import saves exact draft hierarchy, unverified provenance, image metadata and unapproved scoped offers',async()=>{
   const r=await execute(firstInput!,firstTicket,'synthetic-first-intent-001');assert.equal(r.status,200,await r.clone().text());const batch=await r.json();firstBatch=batch.id;assert.equal(batch.status,'SUCCEEDED');assert.equal(batch.summary.newRecords,2);
   const rows=(await db.query('SELECT e.*,s."recordId" FROM "CatalogueEntry" e JOIN "ProductSourceRecord" s ON s."entryId"=e.id WHERE s."sourceId"=$1 ORDER BY s."recordId"',[sourceId])).rows;assert.equal(rows.length,2);assert.ok(rows.every(e=>e.status==='DRAFT'&&!e.published&&e.sourceId===sourceId));entryId=rows[0].id;
   assert.equal(batch.sourceSnapshot.authorizationStatus,'NOT_REQUIRED');assert.equal((await db.query('SELECT count(*)::int n FROM "ProductImportRow" WHERE "batchId"=$1 AND "verificationStatus"=\'UNVERIFIED\' AND "sourceUrl" IS NOT NULL AND "observedAt" IS NOT NULL',[firstBatch])).rows[0].n,2);
   assert.equal((await fetch(base+'/boots/'+rows[0].slug)).status,404);assert.equal((await (await fetch(base+'/api/boots?q=Synthetic%20D2')).json()).total,0);
   const claims=(await db.query('SELECT c.*,r."batchId" FROM "ProductClaim" c JOIN "ProductImportRow" r ON r.id=c."importRowId" WHERE r."batchId"=$1',[firstBatch])).rows;assert.equal(claims.length,1);assert.equal(claims[0].status,'UNVERIFIED');assert.equal(claims[0].sourceId,sourceId);assert.equal(claims[0].observedAt.toISOString(),observedAt);assert.equal(claims[0].reviewedAt,null);
   const images=(await db.query('SELECT i.* FROM "ProductImage" i JOIN "ProductImportRow" r ON r.id=i."importRowId" WHERE r."batchId"=$1',[firstBatch])).rows;assert.equal(images.length,1);assert.equal(images[0].status,'UNVERIFIED');assert.equal(images[0].uploadedImageId,null);
   const offers=(await db.query('SELECT * FROM "RecommendationEvidence" WHERE "entryId"=$1',[entryId])).rows;assert.equal(offers.length,2);assert.ok(offers.every(o=>!o.approved&&o.countryCode==='AU'&&o.importRowId));
   assert.equal((await db.query('SELECT c.swatch FROM "BootColorway" c JOIN "CatalogueEntry" e ON e."colorwayId"=c.id WHERE e.id=$1',[entryId])).rows[0].swatch,null);
  });
  await t.test('D2 repeated and overlapping batches preserve stable source IDs and do not duplicate observations',async()=>{
   const before=[await count('CatalogueEntry'),await count('ProductClaim'),await count('ProductImage')];const same=await execute(firstInput!,firstTicket,'synthetic-first-intent-001');assert.equal(same.status,200);assert.equal((await same.json()).id,firstBatch);
   const p=await preview(firstInput!);assert.equal(p.summary.noops,2);assert.equal((await execute(firstInput!,p.ticket)).status,200);assert.deepEqual([await count('CatalogueEntry'),await count('ProductClaim'),await count('ProductImage')],before);
   const overlap=input([product(2),product(3)]),next=await preview(overlap);assert.equal(next.summary.noops,1);assert.equal(next.summary.newRecords,1);assert.equal((await execute(overlap,next.ticket)).status,200);
   assert.equal((await execute(input([product(999)]),firstTicket,'synthetic-first-intent-001')).status,400);
  });
  await t.test('D2 name/case matches and tier/outsole/source-record contradictions are quarantined without merging',async()=>{
   for(const patch of [{recordId:'synthetic-case',sku:'synthetic-d2-1'},{recordId:'synthetic-name',sku:null}]){const p=await preview(input([product(1,patch)]));assert.equal(p.rows[0].outcome,'POSSIBLE_MATCH');assert.equal(p.summary.newRecords,0);}
   const data=input([product(1,{outsole:'AG'}),product(2,{tier:'Pro'})]),p=await preview(data);assert.equal(p.summary.conflicts,2);const before=await count('CatalogueEntry');const r=await execute(data,p.ticket);assert.equal(r.status,200);assert.equal((await r.json()).summary.staged,2);assert.equal(await count('CatalogueEntry'),before);
  });
  await t.test('D2 verified/public data remains unchanged when incoming attributes conflict or propose additions',async()=>{
   await db.query(`UPDATE "ProductClaim" SET status='VERIFIED',"reviewedAt"=now(),"reviewerId"=$1,"reviewNote"='Synthetic QA review only' WHERE "entryId"=$2`,[aliceId,entryId]);await db.query(`UPDATE "CatalogueEntry" SET published=true WHERE id=$1`,[entryId]);
   try{const before=(await db.query('SELECT row_to_json(e) data FROM "CatalogueEntry" e WHERE id=$1',[entryId])).rows[0].data;const original=(await db.query('SELECT * FROM "ProductClaim" WHERE "entryId"=$1',[entryId])).rows;
    const data=input([product(1,{specifications:[{attribute:'upperMaterial',value:'Synthetic conflicting report',basis:'REPORTED'}]})]),p=await preview(data);assert.equal(p.rows[0].outcome,'CONFLICT');const r=await execute(data,p.ticket);assert.equal(r.status,200);assert.deepEqual((await db.query('SELECT row_to_json(e) data FROM "CatalogueEntry" e WHERE id=$1',[entryId])).rows[0].data,before);assert.deepEqual((await db.query('SELECT * FROM "ProductClaim" WHERE "entryId"=$1',[entryId])).rows,original);
    assert.ok((await (await fetch(base+'/api/boots?q=Synthetic%20D2')).json()).boots.some((e:{id:string;specifications:{upper:{value:string}}})=>e.id===entryId&&e.specifications.upper.value==='Synthetic original upper'));
    const addition=input([product(1,{specifications:[{attribute:'closureSystem',value:'Synthetic proposed closure',basis:'REPORTED'}]})]),a=await preview(addition);assert.equal(a.rows[0].action,'STAGE');assert.equal((await execute(addition,a.ticket)).status,200);assert.equal((await db.query('SELECT count(*)::int n FROM "ProductClaim" WHERE "entryId"=$1 AND attribute=\'closureSystem\'',[entryId])).rows[0].n,0);
   }finally{await db.query('UPDATE "CatalogueEntry" SET published=false WHERE id=$1',[entryId]);}
  });
  await t.test('D2 rejects stale preview and revoked source/admin permissions at execution time',async()=>{
   const a=input([product(30)]),p=await preview(a),b=input([product(31)]);assert.equal((await execute(b,(await preview(b)).ticket)).status,200);assert.equal((await execute(a,p.ticket)).status,409);
   const fresh=await preview(a);await db.query(`UPDATE "ProductSource" SET "authorizationStatus"='DENIED',version=version+1 WHERE id=$1`,[sourceId]);assert.equal((await execute(a,fresh.ticket)).status,400);await db.query(`UPDATE "ProductSource" SET "authorizationStatus"='NOT_REQUIRED',version=version+1 WHERE id=$1`,[sourceId]);
   const ready=await preview(a);await db.query(`UPDATE "User" SET role='USER' WHERE id=$1`,[aliceId]);assert.equal((await execute(a,ready.ticket)).status,403);await db.query(`UPDATE "User" SET role='ADMIN' WHERE id=$1`,[aliceId]);
  });
  await t.test('D2 concurrent identical submissions commit once and are safe to replay',async()=>{
   const data=input([product(40)]),p=await preview(data),key=randomUUID(),before=await count('CatalogueEntry');const results=await Promise.all([execute(data,p.ticket,key),execute(data,p.ticket,key)]);assert.ok(results.every(r=>[200,409].includes(r.status)));assert.ok(results.some(r=>r.status===200));assert.equal(await count('CatalogueEntry'),before+1);assert.equal((await execute(data,p.ticket,key)).status,200);
  });
  await t.test('D2 overlapping concurrent intents re-preview safely instead of duplicating source records',async()=>{
   const data=input([product(41)]),p=await preview(data),keys=[randomUUID(),randomUUID()],before=await count('CatalogueEntry');
   const results=await Promise.all(keys.map(key=>execute(data,p.ticket,key)));assert.ok(results.some(r=>r.status===200));assert.ok(results.every(r=>[200,409].includes(r.status)));
   for(let n=0;n<results.length;n++)if(results[n].status===409)assert.equal((await execute(data,(await preview(data)).ticket,keys[n])).status,200);
   assert.equal(await count('CatalogueEntry'),before+1);
  });
  await t.test('D2 rollback leaves no partial hierarchy and recovers an interrupted RUNNING intent',async()=>{
   const data=input([product(50,{brand:'Synthetic rollback brand',family:'Synthetic rollback family'})]),p=await preview(data),key=randomUUID(),before=[await count('BootBrand'),await count('CatalogueEntry'),await count('ProductSourceRecord')];
   await db.query(`CREATE FUNCTION synthetic_d2_abort() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.slug LIKE '%rollback%' THEN RAISE EXCEPTION 'Synthetic rollback fixture'; END IF; RETURN NEW; END $$; CREATE TRIGGER synthetic_d2_abort BEFORE INSERT ON "CatalogueEntry" FOR EACH ROW EXECUTE FUNCTION synthetic_d2_abort()`);
   try{assert.equal((await execute(data,p.ticket,key)).status,409);assert.deepEqual([await count('BootBrand'),await count('CatalogueEntry'),await count('ProductSourceRecord')],before);}finally{await db.query('DROP TRIGGER synthetic_d2_abort ON "CatalogueEntry"; DROP FUNCTION synthetic_d2_abort()');}
   const batch=(await db.query('SELECT * FROM "ProductImportBatch" WHERE "idempotencyKey"=$1',[key])).rows[0];assert.equal(batch.status,'FAILED');assert.equal((await db.query('SELECT count(*)::int n FROM "ProductImportRow" WHERE "batchId"=$1',[batch.id])).rows[0].n,0);
   await db.query(`UPDATE "ProductImportBatch" SET status='RUNNING',"completedAt"=NULL WHERE id=$1`,[batch.id]);const r=await execute(data,(await preview(data)).ticket,key);assert.equal(r.status,200,await r.clone().text());assert.equal((await r.json()).id,batch.id);
  });
  await t.test('D2 reports are private, paginated, formula-safe and prune payloads without losing idempotency',async()=>{
   assert.equal((await fetch(base+'/api/admin/product-imports/'+firstBatch)).status,401);assert.equal((await bob.request('/api/admin/product-imports/'+firstBatch)).status,403);
   const data=input([product(60,{recordId:'=SYNTHETIC_FORMULA()'})]),r=await execute(data,(await preview(data)).ticket);assert.equal(r.status,200);const batch=await r.json(),csv=await alice.request(`/api/admin/product-imports/${batch.id}?download=csv`);assert.match(csv.headers.get('cache-control')??'',/no-store/);assert.ok((await csv.text()).includes("'=SYNTHETIC_FORMULA()"));
   const refs=await count('ProductSourceRecord');const prune=await alice.request('/api/admin/product-imports/'+firstBatch,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmed:true})});assert.equal(prune.status,200);assert.equal((await db.query('SELECT count(*)::int n FROM "ProductImportRow" WHERE "batchId"=$1 AND data IS NOT NULL',[firstBatch])).rows[0].n,0);assert.equal(await count('ProductSourceRecord'),refs);
   assert.equal((await db.query('SELECT count(*)::int n FROM "ProductImportRow" WHERE "batchId"=$1 AND "sourceUrl" IS NOT NULL AND "observedAt" IS NOT NULL',[firstBatch])).rows[0].n,2);
   assert.equal((await alice.request('/api/admin/product-imports?page=0')).status,400);assert.equal((await alice.request(`/api/admin/product-imports/${firstBatch}?page=0`)).status,400);
  });
  if(process.env.BOOTVERSE_BENCHMARK==='1')await t.test('D2 synthetic 10/100/1000/5000 imports and repeats remain bounded and private',async()=>{
   const bobRole=(await db.query('SELECT role FROM "User" WHERE id=$1',[bobId])).rows[0].role;
   await db.query(`UPDATE "User" SET role='ADMIN' WHERE id=$1`,[bobId]);importBrowser=bob;
   try{for(const size of [10,100,1000,5000]){const products=Array.from({length:size},(_,n)=>product(n,{recordId:`synthetic-scale-${size}-${n}`,brand:`Synthetic D2 scale ${size}`,sku:`SYNTHETIC-SCALE-${size}-${n}`}));const data=input(products);const start=performance.now();prepareImport(data,{id:sourceId,name:'Synthetic benchmark',type:'RETAILER',version:1,brandId:null},emptyGraph());const pureMs=performance.now()-start;
     const previewStart=performance.now(),p=await preview(data),previewMs=performance.now()-previewStart;assert.equal(p.summary.newRecords,size);const writeStart=performance.now(),r=await execute(data,p.ticket);assert.equal(r.status,200,await r.clone().text());const result=await r.json(),writeMs=performance.now()-writeStart;assert.equal(result.summary.newRecords,size);const repeat=await preview(data);assert.equal(repeat.summary.noops,size);const repeated=await execute(data,repeat.ticket);assert.equal(repeated.status,200);const report=await (await alice.request(`/api/admin/product-imports/${result.id}?page=2`)).json();if(size>=100)assert.equal(report.rows.length,50);
     console.log(JSON.stringify({benchmark:'d2-atomic-import',syntheticRows:size,pureParseNormalizeIdentityDedupeMs:Number(pureMs.toFixed(2)),previewMs:Number(previewMs.toFixed(2)),writeHttpMs:Number(writeMs.toFixed(2)),serverTransactionMs:result.summary.durationMs,processHighWaterRssKb:result.summary.processHighWaterRssKb,sqlQueryCount:'not instrumented; bulk inserts use chunks of 250',errorRate:0,repeatNoops:repeat.summary.noops}));
    }}finally{importBrowser=alice;await db.query('UPDATE "User" SET role=$1 WHERE id=$2',[bobRole,bobId]);}
  });
 }finally{await db.query('UPDATE "User" SET role=$1 WHERE id=$2',[oldRole,aliceId]);}
}
