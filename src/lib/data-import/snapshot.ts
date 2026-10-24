import 'server-only';
import type {Prisma} from '@/generated/prisma/client';
import {legacyObservations} from '@/lib/product-data/legacy';
import {parseInput} from './parse';
import {identityName,normalizeRecord} from './normalize';
import type {Graph} from './preview';
import type {ImportRequest} from './schemas';
import {ImportInputError,type defaultLimits} from './types';
export async function readGraph(tx:Prisma.TransactionClient,input:ImportRequest,actorId:string,limits:typeof defaultLimits):Promise<Graph>{
 const normalized=parseInput(input.content,input.format,input.mapping,limits).rows.flatMap(row=>{try{return [normalizeRecord(row.value,input.sourceId)];}catch{return [];}});
 const names=new Set(normalized.map(r=>identityName(r.brand))),recordIds=normalized.map(r=>r.recordId),uploadIds=normalized.flatMap(r=>r.images.flatMap(i=>i.uploadedImageId?[i.uploadedImageId]:[]));
 const allBrands=await tx.bootBrand.findMany({select:{id:true,name:true,status:true,slug:true},orderBy:{id:'asc'},take:1001});if(allBrands.length>1000)throw new ImportInputError('Brand registry limit exceeded; partition the importer configuration.');
 const brands=allBrands.filter(b=>names.has(identityName(b.name))),ids=brands.map(b=>b.id),scope={in:ids};
 const [families,generations,tiers,variants,colorways,entryRows,identifiers,sourceRecords,uploads]=await Promise.all([
  tx.bootFamily.findMany({where:{brandId:scope},orderBy:{id:'asc'},take:20001}),
  tx.bootGeneration.findMany({where:{family:{brandId:scope}},orderBy:{id:'asc'},take:20001}),
  tx.bootTier.findMany({where:{generation:{family:{brandId:scope}}},orderBy:{id:'asc'},take:20001}),
  tx.bootVariant.findMany({where:{tier:{generation:{family:{brandId:scope}}}},select:{id:true,tierModelId:true,generationId:true,surface:true,manufacturerOutsole:true},orderBy:{id:'asc'},take:20001}),
  tx.bootColorway.findMany({where:{generation:{family:{brandId:scope}}},orderBy:{id:'asc'},take:20001}),
  tx.catalogueEntry.findMany({where:{variant:{tier:{generation:{family:{brandId:scope}}}}},select:{id:true,slug:true,outsoleVariantId:true,colorwayId:true,generationId:true,sourceId:true,status:true,sample:true,version:true,specifications:true},orderBy:{id:'asc'},take:20001}),
  tx.productIdentifier.findMany({where:{brandId:scope},select:{entryId:true,brandId:true,value:true,region:true,sourceId:true,sourceUrl:true},orderBy:{id:'asc'},take:50001}),
  tx.productSourceRecord.findMany({where:{sourceId:input.sourceId,recordId:{in:recordIds}},select:{recordId:true,entryId:true,checksum:true,identityHash:true,sourceUrl:true,observedAt:true},orderBy:{recordId:'asc'},take:5001}),
  tx.uploadedImage.findMany({where:{id:{in:uploadIds},ownerId:actorId,state:'READY',status:'PUBLISHED'},select:{id:true},orderBy:{id:'asc'},take:20001}),
 ]);
 if([families,generations,tiers,variants,colorways,entryRows].some(rows=>rows.length>20000)||identifiers.length>50000||sourceRecords.length>5000)throw new ImportInputError('Identity scope too large; review a narrower source/brand dataset.');
 const attributes=[...new Set(normalized.flatMap(r=>r.specifications.map(s=>s.attribute)))];
 const persisted=attributes.length?await tx.productClaim.findMany({where:{status:'VERIFIED',attribute:{in:attributes},OR:[{entryId:{in:entryRows.map(e=>e.id)}},{variantId:{in:variants.map(v=>v.id)}}]},select:{entryId:true,variantId:true,attribute:true,value:true,status:true},orderBy:{id:'asc'},take:100001}):[];
 if(persisted.length>100000)throw new ImportInputError('Verified claim scope too large.');
 const claims:Graph['claims']=[...persisted];
 const entries=entryRows.map(({specifications,...e})=>{claims.push(...legacyObservations({...e,specifications}));return e;});
 return {brands,families,generations,tiers,variants,colorways,entries,identifiers,sourceRecords:sourceRecords.map(r=>({...r,observedAt:r.observedAt.toISOString()})),claims,uploadIds:uploads.map(u=>u.id)};
}
