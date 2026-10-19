import {createRequire} from 'node:module';
import {readFile,writeFile,rm,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:http';
const cwd=process.cwd();
const scratch=await mkdtemp(join(tmpdir(),'bootverse-browser-environment-'));
const require=createRequire(cwd+'/package.json');
const {parse}=require('dotenv'),pg=require('pg'),{SMTPServer}=require('smtp-server');
const {S3Client,CreateBucketCommand,ListObjectsV2Command,DeleteObjectsCommand,DeleteBucketCommand}=require('@aws-sdk/client-s3');
const local=parse(await readFile(cwd+'/.local/development.env'));
for(const key of ['DATABASE_URL','DATABASE_URL_UNPOOLED','S3_ENDPOINT','EMAIL_SERVER','AUTH_URL'])if(!['localhost','127.0.0.1','[::1]'].includes(new URL(local[key]).hostname))throw Error(key+' must be localhost in the QA profile');
const url=new URL(local.DATABASE_URL);
const name='bootverse_browser_'+randomBytes(6).toString('hex');url.pathname='/postgres';
const admin=new pg.Client({connectionString:url.href});
let created=false,bucketCreated=false,db,smtp,mailbox,app,backend,bucket;
try {
await admin.connect();await admin.query(`CREATE DATABASE "${name}"`);created=true;url.pathname='/'+name;
const env={...process.env,...local,DATABASE_URL:url.href,DATABASE_URL_UNPOOLED:url.href,AUTH_SECRET:randomBytes(48).toString('base64url'),AUTH_URL:'http://localhost:3100',EMAIL_SERVER:'smtp://127.0.0.1:1026',NODE_ENV:'production',NODE_OPTIONS:'--trace-deprecation'};
async function command(args){const p=spawn(process.execPath,args,{cwd,env:{...env,NODE_ENV:args.includes("scripts/import-catalogue.mts")?"test":env.NODE_ENV},stdio:'pipe'});p.stdout.resume();p.stderr.resume();const [code]=await once(p,'exit');if(code)throw Error('Local QA setup failed');}
await command(['node_modules/prisma/build/index.js','migrate','deploy']);await command(['--import','tsx','scripts/import-catalogue.mts']);
db=new pg.Client({connectionString:url.href});await db.connect();
await db.query(`INSERT INTO "User"(id,email,role,"updatedAt") VALUES('qa-moderator','remediation@example.test','ADMIN',now())`);
await db.query(`INSERT INTO "UserProfile"(id,"userId",username,"displayName","updatedAt") VALUES('qa-moderator','qa-moderator','qa-moderator','Synthetic QA moderator',now())`);
// Publication, metadata, pagination and variant fixtures: this database is disposable.
await db.query(`INSERT INTO "BootGeneration"(id,"familyId",name) VALUES('qa-generation','mercurial','Synthetic QA generation')`);
await db.query(`INSERT INTO "BootTier"(id,"generationId",name) VALUES('qa-tier-elite','qa-generation','Elite'),('qa-tier-pro','qa-generation','Pro')`);
await db.query(`INSERT INTO "BootColorway"(id,"generationId",name,swatch) VALUES('qa-color','qa-generation','Synthetic QA blue','#112233')`);
for(let n=0;n<7;n++){
 await db.query(`INSERT INTO "BootVariant"(id,"tierModelId","generationId",surface) VALUES($1,$2,'qa-generation',$3)`,['qa-variant-'+n,n<4?'qa-tier-elite':'qa-tier-pro',['FG','AG','TF','SG'][n%4]]);
 const spec=n===0?{upper:{status:'verified',value:'Synthetic QA upper material',sourceUrl:'https://example.test/qa-specification',observedAt:'2026-10-17T00:00:00Z'}}:{};
 await db.query(`INSERT INTO "CatalogueEntry"(id,slug,"outsoleVariantId","colorwayId","generationId",sample,published,specifications) VALUES($1,$1,$2,'qa-color','qa-generation',false,true,$3::jsonb)`,['qa-product-'+n,'qa-variant-'+n,JSON.stringify(spec)]);
}
// Synthetic cohorts live only in this randomly named disposable browser QA database.
await db.query('UPDATE "CatalogueEntry" SET sample=false WHERE "outsoleVariantId"=$1',['mercurial-elite-ag']);
for(let n=0;n<10;n++){
 const id='fit-browser-fixture-'+n;
 await db.query('INSERT INTO "User"(id,email,"emailVerified","updatedAt") VALUES($1,$2,now(),now())',[id,id+'@example.test']);
 await db.query('INSERT INTO "UserProfile"(id,"userId",username,"displayName","updatedAt") VALUES($1::text,$1::text,$1::varchar,$2,now())',[id,'Isolated browser QA reviewer']);
 await db.query(`INSERT INTO "BootReview"(id,"authorId","variantId","sizeWorn","sizeSystem","ownershipMonths","matchesPlayed",experience,pros,cons,comfort,fit,traction,"ballTouch",durability,value,"ratingTotal","footLengthCm","footWidthCm","footShape","shareFootInfo","analysisConsent","analysisConsentAt","widthObservation","toeRoomCategory","heelLockdownCategory","breakInCategory","updatedAt") VALUES($1,$1,'mercurial-elite-ag','9','UK',1,1,'Synthetic browser QA fixture only; this is not a real review.','QA observations','QA limitations',5,4,3,3,3,3,21,$2,10,'average',true,true,now(),'expected','expected','secure','none',now())`,[id,n<5?27:30]);
}
const entry=(await db.query('SELECT id FROM "CatalogueEntry" WHERE "outsoleVariantId"=$1 ORDER BY id LIMIT 1',['mercurial-elite-ag'])).rows[0].id;
for(const [id,kind,payload] of [['finder-ui-surface','SURFACE',{outsole:'AG',allowed:['AG'],denied:['FG']}],['finder-ui-price','PRICE',{entryId:entry,amount:'150',currency:'AUD',size:'9',sizeSystem:'UK'}]]){
 await db.query(`INSERT INTO "RecommendationEvidence"(id,"variantId",kind,"sourceKind","sourceUrl","observedAt","validUntil",payload,approved,"updatedAt") VALUES($1,'mercurial-elite-ag',$2,'MANUFACTURER','https://www.nike.com/synthetic-browser-fixture-only',now()-interval '1 hour',now()+interval '1 day',$3::jsonb,true,now())`,[id,kind,JSON.stringify(payload)]);
}
const mailFile=join(scratch,'mail.eml');
smtp=new SMTPServer({authOptional:true,disabledCommands:['AUTH','STARTTLS'],logger:false,onData(s,_session,cb){const chunks=[];s.on('data',c=>chunks.push(c));s.on('end',async()=>{await writeFile(mailFile,Buffer.concat(chunks),{mode:0o600});console.log('Local QA email captured; no external delivery.');cb()})}});
await new Promise((resolve,reject)=>{smtp.once('error',reject);smtp.listen(1026,'127.0.0.1',resolve);});
mailbox=createServer(async(req,res)=>{try{if(req.url!=='/signin')throw Error('Wrong route');const m=(await readFile(mailFile,'utf8')).replace(/=\r?\n/g,'').replace(/=([0-9A-F]{2})/gi,(_,h)=>String.fromCharCode(parseInt(h,16)));const link=m.split(/\r?\n/).find(x=>x.startsWith('http://localhost:3100/api/auth/callback/nodemailer?'));if(!link)throw Error('No mail');res.writeHead(302,{Location:link,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}).end();}catch{res.writeHead(404).end('No local QA link')}});await new Promise((resolve,reject)=>{mailbox.once('error',reject);mailbox.listen(3111,'127.0.0.1',resolve);});
if(!['localhost','127.0.0.1'].includes(new URL(env.S3_ENDPOINT).hostname))throw Error('Local S3 required');

bucket='bootverse-browser-'+randomBytes(8).toString('hex');
backend=new S3Client({endpoint:env.S3_ENDPOINT,region:env.S3_REGION??'us-east-1',forcePathStyle:true,credentials:{accessKeyId:env.S3_ACCESS_KEY_ID,secretAccessKey:env.S3_SECRET_ACCESS_KEY}});
await backend.send(new CreateBucketCommand({Bucket:bucket}));bucketCreated=true;env.S3_BUCKET=bucket;
await writeFile(join(scratch,'context.json'),JSON.stringify({databaseUrl:url.href,name,bucket}),{mode:0o600});
app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port','3100'],{cwd,env,stdio:'pipe'});app.stdout.on('data',d=>process.stdout.write(d));app.stderr.on('data',d=>process.stderr.write(d));
await new Promise(resolve=>{process.once('SIGTERM',resolve);process.once('SIGINT',resolve);app.once('exit',resolve);console.log('Disposable QA on http://localhost:3100. Sign in as remediation@example.test; captured-mail redirect: http://127.0.0.1:3111/signin. Ctrl-C removes this database and bucket.');});
} finally {
 if(app&&app.exitCode===null&&app.signalCode===null){app.kill('SIGTERM');await once(app,'exit');}
 if(smtp?.server?.listening)await new Promise(resolve=>smtp.close(resolve));
 if(mailbox?.listening)await new Promise(resolve=>mailbox.close(resolve));
 if(db)await db.end().catch(()=>{});
 if(created){await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1',[name]);await admin.query(`DROP DATABASE "${name}"`);}
 await admin.end();
 if(backend&&bucketCreated){
  for(;;){const objects=await backend.send(new ListObjectsV2Command({Bucket:bucket}));if(!objects.Contents?.length)break;await backend.send(new DeleteObjectsCommand({Bucket:bucket,Delete:{Objects:objects.Contents.map(object=>({Key:object.Key}))}}));}
  await backend.send(new DeleteBucketCommand({Bucket:bucket}));backend.destroy();
 }
 await rm(scratch,{recursive:true,force:true});console.log('Owned disposable browser database, bucket and captured email removed.');
}
