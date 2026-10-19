import 'server-only';
import {cache} from 'react';
import {z} from 'zod';
import {getDb} from '@/lib/db';
import {Prisma} from '@/generated/prisma/client';
import {parseFilters,type CatalogueFilters} from './catalogue';
import {surfaces,type CatalogueBoot} from './types';
import {surfaceLabels} from './labels';
import {productSpecifications,productOffers} from './product';
export const PAGE_SIZE=12;
export function catalogueQuery(params:URLSearchParams){
 const filters=parseFilters(params);
 z.object({query:z.string().max(100),brand:z.string().max(120),silo:z.string().max(120),tier:z.string().max(100),surface:z.string().max(20)}).parse(filters);
 return {...filters,page:z.coerce.number().int().min(1).max(1000).parse(params.get('page')??1)};
}
export const productSelect={id:true,slug:true,sample:true,published:true,specifications:true,outsoleVariantId:true,colorwayId:true,
 colorway:{select:{id:true,generationId:true,name:true,swatch:true}},
 variant:{select:{id:true,tierModelId:true,surface:true,recommendationEvidence:{where:{approved:true,kind:"PRICE"},orderBy:[{observedAt:"desc"},{id:"asc"}],take:33,select:{id:true,kind:true,sourceKind:true,sourceUrl:true,observedAt:true,validUntil:true,payload:true}},tier:{select:{id:true,generationId:true,name:true,generation:{select:{id:true,familyId:true,name:true,family:{select:{id:true,brandId:true,name:true,brand:{select:{id:true,name:true}}}}}}}}}}} satisfies Prisma.CatalogueEntrySelect;
type Row=Prisma.CatalogueEntryGetPayload<{select:typeof productSelect}>;
function product(row:Row):CatalogueBoot{
 const tier=row.variant.tier,generation=tier.generation,family=generation.family;
 return {id:row.id,slug:row.slug,outsoleVariantId:row.outsoleVariantId,colorwayId:row.colorwayId,sample:row.sample,
 offers:productOffers(row.sample,row.id,row.variant.recommendationEvidence.map(e=>({...e,observedAt:e.observedAt.toISOString(),validUntil:e.validUntil.toISOString()}))),
 specifications:productSpecifications(row.sample,row.specifications),brand:family.brand,family:{id:family.id,brandId:family.brandId,name:family.name},generation:{id:generation.id,familyId:generation.familyId,name:generation.name},tier:{id:tier.id,generationId:tier.generationId,name:tier.name},variant:{id:row.variant.id,tierModelId:row.variant.tierModelId,surface:surfaces.includes(row.variant.surface as typeof surfaces[number])?row.variant.surface as typeof surfaces[number]:null},colorway:row.colorway};
}
function matchingProducts(filters:CatalogueFilters){
 const clauses=[Prisma.sql`e.published=true`];
 if(filters.brand)clauses.push(Prisma.sql`b.id=${filters.brand}`);
 if(filters.silo)clauses.push(Prisma.sql`f.id=${filters.silo}`);
 if(filters.tier)clauses.push(Prisma.sql`t.name=${filters.tier}`);
 if(filters.surface)clauses.push(filters.surface==='unknown'?Prisma.sql`v.surface IS NULL`:Prisma.sql`v.surface=${filters.surface}`);
 for(const word of filters.query.trim().split(/\s+/).filter(Boolean)){
  const pattern=`%${word.replace(/[\\%_]/g,'\\$&')}%`;
  clauses.push(Prisma.sql`concat_ws(' ',b.name,f.name,g.name,t.name,v.surface,c.name,
   CASE v.surface WHEN 'FG' THEN 'Firm ground' WHEN 'AG' THEN 'Artificial grass' WHEN 'SG' THEN 'Soft ground' WHEN 'TF' THEN 'Turf' ELSE 'Unknown surface' END) ILIKE ${pattern}`);
 }
 return Prisma.sql`FROM "CatalogueEntry" e JOIN "BootVariant" v ON v.id=e."outsoleVariantId"
  JOIN "BootTier" t ON t.id=v."tierModelId" JOIN "BootGeneration" g ON g.id=t."generationId"
  JOIN "BootFamily" f ON f.id=g."familyId" JOIN "BootBrand" b ON b.id=f."brandId"
  JOIN "BootColorway" c ON c.id=e."colorwayId" WHERE ${Prisma.join(clauses,' AND ')}`;
}
export async function listCatalogue(query:ReturnType<typeof catalogueQuery>){
 const match=matchingProducts(query),direction=query.sort==='name-desc'?Prisma.sql`DESC`:Prisma.sql`ASC`;
 // Case-fold in PostgreSQL before pagination; fetching/sorting only a page would give the wrong global order.
 const names=Prisma.sql`lower(f.name) ${direction},lower(t.name) ${direction},lower(c.name) ${direction},e.id ASC`;
 const order=query.sort==='featured'?Prisma.sql`e.id ASC`:query.sort==='brand'?Prisma.sql`lower(b.name) ASC,${names}`:names;
 return getDb().$transaction(async tx=>{
  const count=await tx.$queryRaw<{total:number}[]>(Prisma.sql`SELECT count(*)::int AS total ${match}`);
  const ids=await tx.$queryRaw<{id:string}[]>(Prisma.sql`SELECT e.id ${match} ORDER BY ${order} LIMIT ${PAGE_SIZE} OFFSET ${(query.page-1)*PAGE_SIZE}`);
  const rows=ids.length?await tx.catalogueEntry.findMany({where:{id:{in:ids.map(row=>row.id)},published:true},select:productSelect}):[];
  return {boots:ids.flatMap(({id})=>{const row=rows.find(row=>row.id===id);return row?[product(row)]:[];}),total:count[0].total,page:query.page,pages:Math.ceil(count[0].total/PAGE_SIZE)};
 },{isolationLevel:'RepeatableRead'});
}
export const catalogueOptions=cache(async()=>{
 const [brands,families,tiers]=await Promise.all([
  getDb().bootBrand.findMany({where:{families:{some:{generations:{some:{tiers:{some:{variants:{some:{entries:{some:{published:true}}}}}}}}}}},select:{id:true,name:true},orderBy:{name:'asc'},take:1000}),
  getDb().bootFamily.findMany({where:{generations:{some:{tiers:{some:{variants:{some:{entries:{some:{published:true}}}}}}}}},select:{id:true,name:true},orderBy:{name:'asc'},take:1000}),
  getDb().bootTier.findMany({where:{variants:{some:{entries:{some:{published:true}}}}},select:{name:true},distinct:['name'],orderBy:{name:'asc'},take:1000})]);
 return {brand:brands.sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base'})).map(b=>({value:b.id,label:b.name})),silo:families.sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base'})).map(b=>({value:b.id,label:b.name})),tier:tiers.sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base'})).map(b=>({value:b.name,label:b.name})),surface:[...surfaces.map(s=>({value:s,label:`${s} · ${surfaceLabels[s]}`})),{value:'unknown',label:'Unknown surface'}]};
});
export const getProduct=cache(async(slug:string)=>{
 if(slug.length>160)return null;
 const row=await getDb().catalogueEntry.findFirst({where:{slug,published:true},select:productSelect});return row?product(row):null;
});
export async function generationProducts(id:string){return (await getDb().catalogueEntry.findMany({where:{generationId:id,published:true},select:productSelect,orderBy:{id:'asc'},take:100})).map(product);}
export async function comparisonProducts(ids:string[]){
 const rows=await getDb().catalogueEntry.findMany({where:{id:{in:ids},published:true},select:productSelect,take:4});
 const variants=new Set<string>();return ids.flatMap(id=>{const row=rows.find(r=>r.id===id);if(!row||variants.has(row.outsoleVariantId))return [];variants.add(row.outsoleVariantId);return [product(row)];});
}
export async function homeCatalogue(){
 const featured=(await getDb().catalogueEntry.findMany({where:{published:true},select:productSelect,orderBy:{id:'asc'},take:3})).map(product);
 const counts=await getDb().$queryRaw<{brandId:string;brand:string;surface:string|null;count:number}[]>`
 SELECT b.id AS "brandId",b.name AS brand,v.surface,count(*)::int AS count
 FROM "CatalogueEntry" e JOIN "BootVariant" v ON v.id=e."outsoleVariantId"
 JOIN "BootTier" t ON t.id=v."tierModelId" JOIN "BootGeneration" g ON g.id=t."generationId"
 JOIN "BootFamily" f ON f.id=g."familyId" JOIN "BootBrand" b ON b.id=f."brandId"
 WHERE e.published=true GROUP BY b.id,b.name,v.surface ORDER BY b.name,v.surface LIMIT 1000`;
 return {featured,counts};
}
