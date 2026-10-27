import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir,homedir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
const checks={profile:'finderProfileRecovery',catalogue:'catalogueComparison',admin:'adminFilterRecovery',data:'productDataProvenance',imports:'productImportWorkflow',enrichment:'productEnrichmentWorkflow',review:'productReviewWorkflow'} as const;
const name=process.argv[2] as keyof typeof checks;
if(!checks[name])throw Error('Choose profile, catalogue, admin, data, imports, enrichment or review; use only the disposable QA browser session.');
const session=process.env.BOOTVERSE_BROWSER_SESSION??'remediation';
const base=process.env.BOOTVERSE_BROWSER_URL??'http://localhost:3100';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Browser fixtures may only target localhost.');
const directory=await mkdtemp(join(tmpdir(),'bootverse-browser-'));
try{
 const source=(await readFile('tests/browser-regressions.mjs','utf8')).replace(/^import .*\n/,'').replaceAll('export async function','async function');
 // The CLI sandbox cannot import modules. Keep assertions equivalent to the used Node assert calls.
 const assertions=`const assert={equal(a,b){if(a!==b)throw Error('Expected '+JSON.stringify(b)+', got '+JSON.stringify(a));},match(a,b){if(!b.test(a))throw Error('Expected pattern '+b+', got '+a);}};`;
 const file=join(directory,'check.js');await writeFile(file,`async page=>{page.setDefaultTimeout(15000);${assertions}\n${source}\nreturn await ${checks[name]}(page,${JSON.stringify(base)});}`);
 const cli=process.env.PLAYWRIGHT_CLI??join(homedir(),'.codex/skills/playwright/scripts/playwright_cli.sh');
 const child=spawn(cli,['--session',session,'run-code','--filename',file],{stdio:['ignore','pipe','inherit']});
 let output='';child.stdout.on('data',chunk=>{output+=chunk;process.stdout.write(chunk);});
 const code=await new Promise<number>((resolve,reject)=>{child.once('error',reject);child.once('exit',n=>resolve(n??1));});
 process.exitCode=code||output.includes('### Error')?1:0;
}finally{await rm(directory,{recursive:true,force:true});}
