import 'server-only';
import {z} from 'zod';
import {Prisma} from '@/generated/prisma/client';
import {getDb} from '@/lib/db';
import {lockedActiveUser} from '@/lib/accounts/authorization-db';
import {requireActiveUser,AccessError,type Principal} from '@/lib/accounts/authorization';
import {CommunityError} from '@/lib/community/service';
import {importRequestSchema,executionSchema,type ImportRequest} from './schemas';
import {prepareImport,digest,type PreparedImport} from './preview';
import {readGraph} from './snapshot';
import {persistPlan} from './persist';
import {signPreview,verifyPreview} from './ticket';
import {ImportInputError,importLimits} from './types';
type Tx=Prisma.TransactionClient;
export function localImportsOnly(){try{if(['localhost','127.0.0.1','[::1]'].includes(new URL(process.env.DATABASE_URL??'').hostname))return;}catch{}throw new AccessError(403,'D2 imports require a local database. Remote execution needs separate approval.');}
export function importAdmin(actor:Principal|null){const user=requireActiveUser(actor);if(user.role!=='ADMIN')throw new AccessError(403,'Administrator access is required.');return user;}
async function sourceForImport(tx:Tx,id:string){const source=await tx.productSource.findUnique({where:{id}});if(!source||source.status!=='ACTIVE'||!['GRANTED','NOT_REQUIRED'].includes(source.authorizationStatus)||!source.permissionNotes||!source.permissionUrl||!source.authorizationCheckedAt)throw new CommunityError(400,'Select an active source with documented access permission.');return source;}
const sourceSnapshot=(source:Awaited<ReturnType<typeof sourceForImport>>)=>({type:source.type,version:source.version,authorizationStatus:source.authorizationStatus,permissionUrl:source.permissionUrl,authorizationCheckedAt:source.authorizationCheckedAt?.toISOString()??null});
const inputHash=(r:ImportRequest)=>digest({version:1,...r});
function publicPlan(plan:PreparedImport){return {summary:plan.summary,ready:plan.ready,warnings:plan.warnings,rows:plan.rows.map(({data,...row})=>({...row,label:data?[data.brand,data.family,data.generation,data.tier,data.outsole??'Unknown',data.colorway].join(' · '):'Invalid row'}))};}
export async function previewImport(actor:Principal|null,raw:unknown){
 localImportsOnly();const user=importAdmin(actor),input=importRequestSchema.parse(raw),limits=importLimits();
 const plan=await getDb().$transaction(async tx=>{
  await tx.$executeRaw`SET TRANSACTION READ ONLY`;
  importAdmin(await tx.user.findUnique({where:{id:user.id},select:{id:true,role:true,status:true,emailVerified:true}}));
  const source=await sourceForImport(tx,input.sourceId);return prepareImport(input,source,await readGraph(tx,input,user.id,limits),limits);
 },{isolationLevel:'RepeatableRead',timeout:30000});
 return {...publicPlan(plan),ticket:plan.ready?signPreview(user.id,inputHash(input),plan.hash,process.env.AUTH_SECRET??''):null};
}
export async function executeImport(actor:Principal|null,raw:unknown){
 localImportsOnly();const user=importAdmin(actor),data=executionSchema.parse(raw);const {ticket,idempotencyKey,confirmed,...input}=data;void confirmed;const checksum=inputHash(input),db=getDb();
 let batch=await db.productImportBatch.findUnique({where:{sourceId_idempotencyKey:{sourceId:input.sourceId,idempotencyKey}}});
 const approval=verifyPreview(ticket,user.id,checksum,process.env.AUTH_SECRET??'',Date.now(),batch?.status==='SUCCEEDED');
 if(batch&&batch.checksum!==checksum)throw new CommunityError(409,'Idempotency key belongs to a different input.');
 if(batch?.status==='SUCCEEDED')return batch;
 if(!batch){try{batch=await db.$transaction(async tx=>{importAdmin(await lockedActiveUser(tx,user));const source=await sourceForImport(tx,input.sourceId);return tx.productImportBatch.create({data:{sourceId:input.sourceId,actorId:user.id,format:input.format,checksum,idempotencyKey,sourceSnapshot:sourceSnapshot(source)}});});}catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')batch=await db.productImportBatch.findUniqueOrThrow({where:{sourceId_idempotencyKey:{sourceId:input.sourceId,idempotencyKey}}});else throw error;}}
 if(batch.checksum!==checksum)throw new CommunityError(409,'Idempotency key belongs to a different input.');
 const batchId=batch.id;let claimed=false;const started=performance.now();
 try{return await db.$transaction(async tx=>{
  const [lock]=await tx.$queryRaw<{acquired:boolean}[]>`SELECT pg_try_advisory_xact_lock(734982165) AS acquired`;
  if(!lock.acquired)throw new CommunityError(409,'Another import is executing. Retry this intent after it finishes.');claimed=true;
  importAdmin(await lockedActiveUser(tx,user));await tx.$queryRaw`SELECT id FROM "ProductSource" WHERE id=${input.sourceId} FOR SHARE`;
  await tx.$queryRaw`SELECT id FROM "ProductImportBatch" WHERE id=${batchId} FOR UPDATE`;
  const current=await tx.productImportBatch.findUniqueOrThrow({where:{id:batchId}});if(current.status==='SUCCEEDED')return current;
  const source=await sourceForImport(tx,input.sourceId),limits=importLimits();const plan=prepareImport(input,source,await readGraph(tx,input,user.id,limits),limits);
  if(!plan.ready||plan.hash!==approval.planHash)throw new CommunityError(409,'Preview is stale. Validate again before executing this intent.');
  await tx.productImportBatch.update({where:{id:batchId},data:{status:'RUNNING',completedAt:null,errorCode:null}});
  const imageIds=[...new Set(plan.rows.flatMap(r=>r.data?.images.flatMap(i=>i.uploadedImageId?[i.uploadedImageId]:[])??[]))];if(imageIds.length)await tx.$queryRaw(Prisma.sql`SELECT id FROM "UploadedImage" WHERE id IN (${Prisma.join(imageIds)}) FOR SHARE`);
  await persistPlan(tx,plan,batchId,input.sourceId,source.type);
  await tx.moderationAction.create({data:{actorId:user.id,targetKey:`IMPORT:${batchId}`,action:'IMPORT_PRODUCTS',note:`Atomic D2 import: ${plan.summary.newRecords} drafts, ${plan.summary.staged} staged, ${plan.summary.noops} no-ops. Nothing auto-published.`}});
  return tx.productImportBatch.update({where:{id:batchId},data:{status:'SUCCEEDED',completedAt:new Date(),sourceSnapshot:sourceSnapshot(source),summary:{...plan.summary,durationMs:Math.round(performance.now()-started),processHighWaterRssKb:process.resourceUsage().maxRSS,queryCount:null}}});
 },{isolationLevel:'Serializable',timeout:120000,maxWait:5000});}
 catch(error){if(claimed)await db.productImportBatch.updateMany({where:{id:batchId,status:'RUNNING'},data:{status:'FAILED',completedAt:new Date(),errorCode:error instanceof AccessError?'AUTHORIZATION':error instanceof CommunityError&&error.status===409?'PREVIEW_STALE':'DATABASE'}}).catch(()=>{});if(error instanceof AccessError||error instanceof CommunityError||error instanceof ImportInputError)throw error;throw new CommunityError(409,'Import rolled back. Inspect the batch and validate again before retrying.');}
}
export async function importHistory(actor:Principal|null,input:unknown){localImportsOnly();importAdmin(actor);const q=z.object({page:z.coerce.number().int().min(1).max(1000).default(1)}).strict().parse(input);const db=getDb();const [total,batches,sources]=await Promise.all([db.productImportBatch.count(),db.productImportBatch.findMany({orderBy:[{startedAt:'desc'},{id:'asc'}],take:20,skip:(q.page-1)*20,select:{id:true,sourceId:true,format:true,status:true,summary:true,sourceSnapshot:true,errorCode:true,startedAt:true,completedAt:true}}),db.productSource.findMany({where:{status:'ACTIVE'},orderBy:[{name:'asc'},{id:'asc'}],take:100,select:{id:true,name:true,type:true,authorizationStatus:true}})]);return {batches,sources,total,page:q.page,pages:Math.ceil(total/20),limits:importLimits()};}
export async function importReport(actor:Principal|null,id:string,page=1,all=false){localImportsOnly();importAdmin(actor);z.string().min(1).max(100).parse(id);z.number().int().min(1).max(1000).parse(page);const batch=await getDb().productImportBatch.findUnique({where:{id},select:{id:true,sourceId:true,format:true,status:true,summary:true,sourceSnapshot:true,errorCode:true,startedAt:true,completedAt:true}});if(!batch)throw new CommunityError(404,'Import batch not found.');const [total,rows]=await Promise.all([getDb().productImportRow.count({where:{batchId:id}}),getDb().productImportRow.findMany({where:{batchId:id},orderBy:{rowNumber:'asc'},take:all?5000:50,skip:all?0:(page-1)*50})]);return {...batch,rows,total,page,pages:Math.ceil(total/50)};}
export async function pruneImport(actor:Principal|null,id:string){localImportsOnly();const user=importAdmin(actor);return getDb().$transaction(async tx=>{importAdmin(await lockedActiveUser(tx,user));const batch=await tx.productImportBatch.findUnique({where:{id}});if(!batch)throw new CommunityError(404,'Import batch not found.');if(batch.status==='RUNNING')throw new CommunityError(409,'Wait for the import to finish before pruning.');await tx.productImportRow.updateMany({where:{batchId:id},data:{data:Prisma.DbNull}});await tx.moderationAction.create({data:{actorId:user.id,targetKey:`IMPORT:${id}`,action:'PRUNE_IMPORT',note:'Removed canonical row payloads; batch outcomes, provenance links and source idempotency mappings retained.'}});return {pruned:true};});}
