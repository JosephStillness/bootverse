import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import type {TestContext} from 'node:test';
import type pg from 'pg';

export async function databaseVerificationTests(t:TestContext,db:pg.Client,env:NodeJS.ProcessEnv){
 const directory=await mkdtemp(join(tmpdir(),'bootverse-verify-'));
 try{
  const file=join(directory,'database.env');
  await writeFile(file,`DATABASE_URL=${env.DATABASE_URL}\nDATABASE_URL_UNPOOLED=${env.DATABASE_URL_UNPOOLED}\n`,{mode:0o600});
  const run=(args:string[])=>new Promise<{code:number|null;output:string}>( (resolve,reject)=>{
   const child=spawn(process.execPath,['--import','tsx','scripts/verify-database.mts',...args],{env,stdio:'pipe'});let output='';
   child.stdout.on('data',x=>{output+=x.toString();});child.stderr.on('data',x=>{output+=x.toString();});child.once('error',reject);child.once('exit',code=>resolve({code,output}));
  });
  await t.test('database verifier requires explicit env selection and never prints credentials',async()=>{
   const r=await run([]);assert.notEqual(r.code,0);assert.ok(!r.output.includes(env.DATABASE_URL!));
   const mismatch=join(directory,'mismatch.env');await writeFile(mismatch,`DATABASE_URL=${env.DATABASE_URL}\nDATABASE_URL_UNPOOLED=postgresql://unused@wrong-target.invalid/other?sslmode=verify-full\n`,{mode:0o600});
   const different=await run(['--env-file',mismatch]);assert.notEqual(different.code,0);assert.ok(different.output.includes('database-target-mismatch'));
   const insecure=join(directory,'insecure.env');await writeFile(insecure,'DATABASE_URL=postgresql://unused@wrong-target.invalid/other?sslmode=require\n',{mode:0o600});
   const tls=await run(['--env-file',insecure]);assert.notEqual(tls.code,0);assert.ok(tls.output.includes('verified-tls'));
  });
  await t.test('database verifier accepts migrated schema and detects history or constraint damage',async()=>{
   const before=(await db.query('SELECT count(*) FROM "User"')).rows[0].count;
   const args=['--env-file',file];const good=await run(args);assert.equal(good.code,0,good.output);assert.equal(JSON.parse(good.output).status,'PASS');
   const row=(await db.query('SELECT id,checksum FROM "_prisma_migrations" ORDER BY migration_name LIMIT 1')).rows[0];
   try{await db.query('UPDATE "_prisma_migrations" SET checksum=$1 WHERE id=$2',['0'.repeat(64),row.id]);const bad=await run(args);assert.notEqual(bad.code,0);assert.ok(bad.output.includes('migration-checksum'));}
   finally{await db.query('UPDATE "_prisma_migrations" SET checksum=$1 WHERE id=$2',[row.checksum,row.id]);}
   try{await db.query('ALTER TABLE "User" ADD CONSTRAINT verification_qa CHECK (true) NOT VALID');const bad=await run(args);assert.notEqual(bad.code,0);assert.ok(bad.output.includes('unvalidated-constraints'));}
   finally{await db.query('ALTER TABLE "User" DROP CONSTRAINT verification_qa');}
   assert.equal((await db.query('SELECT count(*) FROM "User"')).rows[0].count,before);
   assert.ok(!good.output.includes(env.DATABASE_URL!));
  });
 }finally{await rm(directory,{recursive:true,force:true});}
}
