import 'server-only';
import {Prisma} from '@/generated/prisma/client';
import type {PreparedImport} from './preview';
export async function persistPlan(tx:Prisma.TransactionClient,plan:PreparedImport,batchId:string,sourceId:string,sourceType:string){
 const x=plan.inserts;
 async function chunks<T>(rows:T[],save:(part:T[])=>Promise<unknown>){for(let at=0;at<rows.length;at+=250)await save(rows.slice(at,at+250));}
 await chunks(x.brands,rows=>tx.bootBrand.createMany({data:rows}));
 await chunks(x.families,rows=>tx.bootFamily.createMany({data:rows}));
 await chunks(x.generations,rows=>tx.bootGeneration.createMany({data:rows}));
 await chunks(x.tiers,rows=>tx.bootTier.createMany({data:rows}));
 await chunks(x.variants,rows=>tx.bootVariant.createMany({data:rows}));
 await chunks(x.colorways,rows=>tx.bootColorway.createMany({data:rows}));
 await chunks(x.entries,rows=>tx.catalogueEntry.createMany({data:rows.map(e=>({...e,status:'DRAFT' as const,published:false}))}));
 await chunks(x.identifiers,rows=>tx.productIdentifier.createMany({data:rows}));
 const rowIds=new Map(plan.rows.map(row=>[row.row,crypto.randomUUID()]));
 await chunks(plan.rows,rows=>tx.productImportRow.createMany({data:rows.map(r=>({id:rowIds.get(r.row)!,batchId,rowNumber:r.row,recordId:r.recordId,entryId:r.entryId,outcome:r.outcome,action:r.action,checksum:r.checksum,sourceUrl:r.data?.sourceUrl??null,observedAt:r.data?new Date(r.data.observedAt):null,verificationStatus:'UNVERIFIED' as const,diagnostics:r.diagnostics,data:r.data?JSON.parse(JSON.stringify(r.data)) as Prisma.InputJsonObject:Prisma.DbNull}))}));
 const claims:Prisma.ProductClaimCreateManyInput[]=[],images:Prisma.ProductImageCreateManyInput[]=[],offers:Prisma.RecommendationEvidenceCreateManyInput[]=[];
 for(const row of plan.rows)if(row.action==='CREATE_DRAFT'&&row.data){const r=row.data,entryId=row.entryId!,importRowId=rowIds.get(row.row)!;
  for(const s of r.specifications)claims.push({...s,entryId,importRowId,sourceId,sourceUrl:r.sourceUrl,observedAt:new Date(r.observedAt),status:'UNVERIFIED'});
  for(const image of r.images)images.push({...image,entryId,importRowId,status:'UNVERIFIED'});
  for(const offer of r.offers){const scope={entryId,size:offer.size,sizeSystem:offer.sizeSystem};const common={variantId:row.variantId!,entryId,sourceId,importRowId,countryCode:offer.countryCode,sourceUrl:offer.sourceUrl,sourceKind:sourceType==='MANUFACTURER'?'MANUFACTURER':'RETAILER',observedAt:new Date(offer.observedAt),validUntil:new Date(offer.validUntil),approved:false};offers.push({...common,kind:'PRICE',payload:{...scope,amount:offer.amount,currency:offer.currency}});if(offer.available!==undefined)offers.push({...common,kind:'AVAILABILITY',payload:{...scope,available:offer.available}});}
 }
 await chunks(claims,rows=>tx.productClaim.createMany({data:rows}));await chunks(images,rows=>tx.productImage.createMany({data:rows}));await chunks(offers,rows=>tx.recommendationEvidence.createMany({data:rows}));
 // Bulk upsert only already-resolved source identities; never move an established mapping.
 await chunks(x.sourceRecords,rows=>tx.$executeRaw(Prisma.sql`
  INSERT INTO "ProductSourceRecord" (id,"sourceId","recordId","entryId",checksum,"identityHash","sourceUrl","observedAt","lastBatchId","updatedAt") VALUES
  ${Prisma.join(rows.map(r=>Prisma.sql`(${crypto.randomUUID()},${sourceId},${r.recordId},${r.entryId},${r.checksum},${r.identityHash},${r.sourceUrl},${new Date(r.observedAt)},${batchId},now())`))}
  ON CONFLICT ("sourceId","recordId") DO UPDATE SET checksum=excluded.checksum,"lastBatchId"=excluded."lastBatchId","sourceUrl"=excluded."sourceUrl","observedAt"=excluded."observedAt","updatedAt"=now()
  WHERE "ProductSourceRecord"."entryId" IS NOT DISTINCT FROM excluded."entryId" AND "ProductSourceRecord"."identityHash"=excluded."identityHash"
 `));
}
