import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {parse} from 'dotenv';
import pg from 'pg';
import {Prisma} from '../src/generated/prisma/client';

// Read-only only: explicit private env file, no ambient .env fallback or migration command.
const fail=(issue:string)=>{console.log(JSON.stringify({status:'FAIL',issues:[issue]}));return 1;};
async function main(){
 if(process.argv.length!==4||process.argv[2]!=='--env-file')return fail('explicit-env-file-required');
 const vars=parse(readFileSync(process.argv[3]));
 const connectionString=vars.DATABASE_URL_UNPOOLED||vars.DATABASE_URL;
 if(!connectionString)return fail('database-url-required');
 const url=new URL(connectionString);
 if(vars.DATABASE_URL&&vars.DATABASE_URL_UNPOOLED){
  const app=new URL(vars.DATABASE_URL);
  const endpoint=(u:URL)=>u.hostname.replace(/-pooler(?=\.)/,'')+':'+(u.port||'5432')+u.pathname;
  if(endpoint(app)!==endpoint(url))return fail('database-target-mismatch');
 }
 const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(!['postgres:','postgresql:'].includes(url.protocol)||(!local&&url.searchParams.get('sslmode')!=='verify-full'))return fail('require-postgresql-and-verified-tls');
 const migrations=readdirSync('prisma/migrations').filter(x=>/^\d/.test(x)).sort();
 const issues:string[]=[];
 const db=new pg.Client({connectionString,connectionTimeoutMillis:5000,query_timeout:10000});
 const counts={tables:0,completedMigrations:0,foreignKeys:0,checks:0,uniqueIndexes:0};
 try{
  await db.connect();await db.query('BEGIN READ ONLY');await db.query("SET LOCAL statement_timeout='10s'");
  const tables=(await db.query<{name:string}>("SELECT tablename AS name FROM pg_tables WHERE schemaname='public'")).rows.map(x=>x.name);counts.tables=tables.length;
  if(!tables.includes('_prisma_migrations'))issues.push('missing-migration-history');
  else{
   const history=(await db.query<{migration_name:string;checksum:string;completed:boolean;rolled_back:boolean}>('SELECT migration_name,checksum,finished_at IS NOT NULL AS completed,rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations"')).rows;
   const completed=history.filter(x=>x.completed&&!x.rolled_back);counts.completedMigrations=completed.length;
   if(history.some(x=>!x.completed&&!x.rolled_back))issues.push('unfinished-migration');
   if(completed.some(x=>!migrations.includes(x.migration_name)))issues.push('unexpected-migration');
   for(const name of migrations){
    const rows=completed.filter(x=>x.migration_name===name);
    if(rows.length!==1)issues.push('pending-or-duplicate-migration');
    else if(rows[0].checksum!==createHash('sha256').update(readFileSync(`prisma/migrations/${name}/migration.sql`)).digest('hex'))issues.push('migration-checksum');
   }
  }
  if(Object.values(Prisma.ModelName).some(name=>!tables.includes(name)))issues.push('missing-model-tables');
  const constraints=(await db.query<{name:string;kind:string;validated:boolean}>("SELECT conname AS name,contype AS kind,convalidated AS validated FROM pg_constraint WHERE connamespace='public'::regnamespace")).rows;
  counts.foreignKeys=constraints.filter(x=>x.kind==='f').length;counts.checks=constraints.filter(x=>x.kind==='c').length;
  if(constraints.some(x=>!x.validated))issues.push('unvalidated-constraints');
  for(const name of ['UserProfile_username_format','BootReview_ratings_check','BootReview_analysis_consent_check','FootProfile_consent','CatalogueEntry_specifications_object','image_target','report_target','video_target','storage_deletion_key'])if(!constraints.some(x=>x.name===name&&x.kind==='c'))issues.push('missing-critical-check');
  const indexes=(await db.query<{valid:boolean;unique:boolean}>("SELECT i.indisvalid AS valid,i.indisunique AS unique FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid WHERE t.relnamespace='public'::regnamespace")).rows;
  counts.uniqueIndexes=indexes.filter(x=>x.unique).length;if(indexes.some(x=>!x.valid))issues.push('invalid-indexes');
  const triggers=(await db.query<{name:string;enabled:string}>("SELECT t.tgname AS name,t.tgenabled AS enabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal")).rows;
  for(const name of ['PostVote_score','Comment_count','boot_review_identity','review_helpful_guard','image_cleanup'])if(!triggers.some(x=>x.name===name&&['O','A'].includes(x.enabled)))issues.push('missing-or-disabled-trigger');
  await db.query('ROLLBACK');
 }finally{await db.end();}
 if(!issues.length){
  // Introspection-only diff. Capture all output: Prisma diagnostics may contain endpoint names.
  const result=spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','diff','--from-config-datasource','--to-schema','prisma/schema.prisma','--exit-code'],{env:{...process.env,DATABASE_URL:vars.DATABASE_URL??connectionString,DATABASE_URL_UNPOOLED:vars.DATABASE_URL_UNPOOLED??''},encoding:'utf8',timeout:30000});
  if(result.error||result.status!==0)issues.push(result.status===2?'schema-drift':'schema-diff-unavailable');
 }
 console.log(JSON.stringify({status:issues.length?'FAIL':'PASS',targetFingerprint:createHash('sha256').update(url.hostname+url.pathname).digest('hex').slice(0,12),local,...counts,issues:[...new Set(issues)]}));return issues.length?1:0;
}
try{process.exitCode=await main();}catch{process.exitCode=fail('verification-unavailable');}
