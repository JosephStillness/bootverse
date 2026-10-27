import {compareClaims} from '@/lib/product-data/comparison';
import {createHash} from 'node:crypto';
import {ZodError} from 'zod';
import {parseInput} from './parse';
import {normalizeRecord,identityName,type CanonicalProduct} from './normalize';
import type {ImportRequest} from './schemas';
import {defaultLimits,ImportInputError,type DiagnosticRow,type ImportAction} from './types';

export function stableJson(value:unknown):string{
 if(value instanceof Date)return JSON.stringify(value.toISOString());
 if(Array.isArray(value))return '['+value.map(stableJson).join(',')+']';
 if(value!==null&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b,'en')).map(([k,v])=>JSON.stringify(k)+':'+stableJson(v)).join(',')+'}';
 return JSON.stringify(value)??'null';
}
export const digest=(value:unknown)=>createHash('sha256').update(stableJson(value)).digest('hex');
const key=(...values:unknown[])=>stableJson(values);
const id=(kind:string,...parts:unknown[])=>'d2-'+kind+'-'+digest(parts).slice(0,28);
const slug=(label:string,stableId:string)=>(label.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,110).replace(/-$/,'')||'record')+'-'+stableId.slice(-16);
type Named={id:string;name:string};
export type ImportSource={id:string;name:string;type:string;version:number;brandId:string|null};
type Brand=Named&{status:string;slug?:string|null};
type Family=Named&{brandId:string};
type Generation=Named&{familyId:string};
type Tier=Named&{generationId:string};
type Variant={id:string;tierModelId:string;generationId:string;surface:string|null;manufacturerOutsole?:string|null};
type Colorway=Named&{generationId:string;swatch:string|null;colorNames?:string[]};
type Entry={id:string;slug:string;outsoleVariantId:string;colorwayId:string;generationId:string;sourceId:string|null;status:string;sample:boolean;version:number};
type Identifier={entryId:string;brandId:string;region:string;value:string;sourceId:string;sourceUrl:string};
type SourceRecord={recordId:string;entryId:string|null;checksum:string;identityHash:string;sourceUrl:string;observedAt:string};
export type Graph={brands:Brand[];families:Family[];generations:Generation[];tiers:Tier[];variants:Variant[];colorways:Colorway[];entries:Entry[];identifiers:Identifier[];sourceRecords:SourceRecord[];claims:{entryId:string|null;variantId:string|null;attribute:string;value:unknown;status:string}[];uploadIds:string[]};
export function emptyGraph():Graph{return {brands:[],families:[],generations:[],tiers:[],variants:[],colorways:[],entries:[],identifiers:[],sourceRecords:[],claims:[],uploadIds:[]};}
type Inserts=Omit<Graph,'claims'|'uploadIds'>;
export type PreparedRow=DiagnosticRow&{action:ImportAction;entryId:string|null;variantId:string|null;checksum:string|null;identityHash:string|null;data:CanonicalProduct|null};
function identity(r:CanonicalProduct){return [identityName(r.brand),identityName(r.family),identityName(r.generation),identityName(r.tier),r.outsole,identityName(r.colorway)];}
export function prepareImport(input:ImportRequest,source:ImportSource,graph:Graph,limits=defaultLimits){
 const parsed=parseInput(input.content,input.format,input.mapping,limits);
 const inserts:Inserts={brands:[],families:[],generations:[],tiers:[],variants:[],colorways:[],entries:[],identifiers:[],sourceRecords:[]};
 const rows:PreparedRow[]=parsed.rows.map(row=>{
  try{if(row.errors.length)throw new ImportInputError(row.errors.join(','));const data=normalizeRecord(row.value,source.id);if(Buffer.byteLength(stableJson(data))>65536)throw new ImportInputError('record_exceeds_64kb');const {rawIdentity:raw,...normalized}=data;void raw;
   return {row:row.row,recordId:data.recordId,outcome:'NEW_RECORD',action:'CREATE_DRAFT',entryId:null,variantId:null,checksum:digest(normalized),identityHash:digest([...identity(data),data.constructionKey]),data,diagnostics:[...(!data.sku?['missing_sku']:[]),...(!data.outsole?['unknown_outsole']:[]),...(!data.constructionKey?['construction_not_shared']:[]),...(!data.swatch?['unknown_swatch']:[])]};
  }catch(error){const missing=error instanceof ZodError&&error.issues.some(i=>['brand','family','generation','tier','colorway','recordId','sourceUrl','observedAt'].includes(String(i.path[0]))&&i.code==='invalid_type');return {row:row.row,recordId:null,outcome:missing?'INSUFFICIENT_IDENTITY':'INVALID',action:'REJECT',entryId:null,variantId:null,checksum:null,identityHash:null,data:null,diagnostics:error instanceof ZodError?error.issues.slice(0,10).map(i=>`${i.path.join('.')}:${i.code}`):[error instanceof ImportInputError?error.message:'invalid_record']};}
 });
 const byRecord=new Map<string,Set<string>>(),bySku=new Map<string,Set<string>>();
 for(const row of rows)if(row.data){const r=row.data;const recordKey=r.recordId;const skuKey=key(identityName(r.brand),r.skuRegion,r.sku);if(!byRecord.has(recordKey))byRecord.set(recordKey,new Set());byRecord.get(recordKey)!.add(row.checksum!);if(r.sku){if(!bySku.has(skuKey))bySku.set(skuKey,new Set());bySku.get(skuKey)!.add(digest(identity(r)));}}
 const brandMap=new Map(graph.brands.map(b=>[b.id,b])),familyMap=new Map(graph.families.map(f=>[f.id,f])),genMap=new Map(graph.generations.map(g=>[g.id,g])),tierMap=new Map(graph.tiers.map(t=>[t.id,t])),variantMap=new Map(graph.variants.map(v=>[v.id,v])),colorMap=new Map(graph.colorways.map(c=>[c.id,c]));
 const entries=new Map(graph.entries.map(e=>[e.id,e]));const records=new Map(graph.sourceRecords.map(r=>[r.recordId,r]));const variantColorPairs=new Set(graph.entries.map(e=>key(e.outsoleVariantId,e.colorwayId)));
 const names=new Map<string,string[]>(),skus=new Map<string,string[]>(),foldedSkus=new Map<string,string[]>();
 const index=(map:Map<string,string[]>,k:string,value:string)=>map.set(k,[...(map.get(k)??[]),value]);
 function indexEntry(e:Entry){const v=variantMap.get(e.outsoleVariantId),t=v&&tierMap.get(v.tierModelId),g=t&&genMap.get(t.generationId),f=g&&familyMap.get(g.familyId),b=f&&brandMap.get(f.brandId),c=colorMap.get(e.colorwayId);if(b&&f&&g&&t&&v&&c)index(names,key(identityName(b.name),identityName(f.name),identityName(g.name),identityName(t.name),v.surface,identityName(c.name)),e.id);}
 graph.entries.forEach(indexEntry);for(const s of graph.identifiers){index(skus,key(s.brandId,s.region,s.value),s.entryId);index(foldedSkus,key(s.brandId,s.region,s.value.toLowerCase()),s.entryId);}
 const namedIndex=new Map<string,Named[]>();
 function indexNamed(kind:string,parent:string,entity:Named){const k=key(kind,parent,identityName(entity.name));namedIndex.set(k,[...(namedIndex.get(k)??[]),entity]);}
 graph.brands.forEach(b=>indexNamed('brand','',b));graph.families.forEach(f=>indexNamed('family',f.brandId,f));graph.generations.forEach(g=>indexNamed('generation',g.familyId,g));graph.tiers.forEach(t=>indexNamed('tier',t.generationId,t));
 const claims=new Map<string,Graph['claims']>();for(const c of graph.claims)if(c.status==='VERIFIED'){const target=c.entryId?'e:'+c.entryId:'v:'+c.variantId;claims.set(target,[...(claims.get(target)??[]),c]);}
 for(const row of rows){if(!row.data)continue;const r=row.data;
  const stage=(outcome:PreparedRow['outcome'],reason:string,entryId:string|null=null)=>{row.outcome=outcome;row.action=outcome==='CONFLICT'?'QUARANTINE':'STAGE';row.diagnostics.push(reason);row.entryId=entryId;row.variantId=entryId?entries.get(entryId)?.outsoleVariantId??null:null;};
  if(byRecord.get(r.recordId)!.size>1||(r.sku&&(bySku.get(key(identityName(r.brand),r.skuRegion,r.sku))?.size??0)>1)){stage('CONFLICT','contradictory_file_identifier');continue;}
  const selected: {kind:string;parent:string;entity:Named;fresh:boolean}[]=[];let parent='',ambiguous=false;
  for(const [kind,name] of [['brand',r.brand],['family',r.family],['generation',r.generation],['tier',r.tier]]){const found=namedIndex.get(key(kind,parent,identityName(name)))??[];if(found.length>1)ambiguous=true;const entity=found[0]??{id:id(kind,parent,identityName(name)),name};selected.push({kind,parent,entity,fresh:!found.length});parent=entity.id;}
  if(ambiguous){stage('POSSIBLE_MATCH','ambiguous_parent_identity');continue;}
  const [b,f,g,t]=selected.map(x=>x.entity);
  if(brandMap.get(b.id)?.status==='ARCHIVED'||(source.type==='MANUFACTURER'&&source.brandId!==b.id)){stage('CONFLICT','manufacturer_or_brand_conflict');continue;}
  if(r.images.some(i=>i.uploadedImageId&&!graph.uploadIds.includes(i.uploadedImageId))){row.action='REJECT';row.outcome='INVALID';row.diagnostics.push('invalid_image_reference');continue;}
  if(r.offers.length&&!['MANUFACTURER','RETAILER','PRODUCT_FEED','AFFILIATE_FEED'].includes(source.type)){row.action='REJECT';row.outcome='INVALID';row.diagnostics.push('offer_source_type');continue;}
  const existingRecord=records.get(r.recordId),skuMatches=r.sku?skus.get(key(b.id,r.skuRegion,r.sku))??[]:[];
  const target=existingRecord?.entryId??(skuMatches.length===1?skuMatches[0]:null);
  if(existingRecord&&!existingRecord.entryId){stage('POSSIBLE_MATCH','source_record_pending_resolution');if(existingRecord.checksum===row.checksum)row.action='NOOP';continue;}
  if(skuMatches.length>1||(existingRecord?.entryId&&skuMatches.some(match=>match!==existingRecord.entryId))){stage('CONFLICT','source_sku_disagreement');continue;}
  if(target){const e=entries.get(target);const matches=names.get(key(...identity(r)))??[];
   if(!e||!matches.includes(target)||(existingRecord&&existingRecord.identityHash!==row.identityHash)){stage('CONFLICT','existing_identity_changed',target);continue;}
   const verified=[...(claims.get('e:'+target)??[]),...(claims.get('v:'+e.outsoleVariantId)??[])];
   if(r.specifications.some(s=>verified.some(c=>c.attribute===s.attribute&&compareClaims(s.attribute,c.value,s.value)==='CONFLICT'))){stage('CONFLICT','verified_attribute_conflict',target);continue;}
   row.outcome='EXACT_MATCH';row.entryId=target;row.variantId=e.outsoleVariantId;row.action=existingRecord?.checksum===row.checksum?'NOOP':'STAGE';if(row.action==='STAGE')row.diagnostics.push('existing_product_unchanged');
  }else if((!r.sku&&(names.get(key(...identity(r)))?.length??0)>0)||(r.sku&&(foldedSkus.get(key(b.id,r.skuRegion,r.sku.toLowerCase()))?.length??0)>0)){stage('POSSIBLE_MATCH','name_or_case_only_match');continue;
  }else{
   for(const part of selected)if(part.fresh){indexNamed(part.kind,part.parent,part.entity);if(part.kind==='brand'){const entity={...part.entity,status:'ACTIVE',slug:slug(part.entity.name,part.entity.id)};inserts.brands.push(entity);brandMap.set(entity.id,entity);}if(part.kind==='family'){const entity={...part.entity,brandId:b.id};inserts.families.push(entity);familyMap.set(entity.id,entity);}if(part.kind==='generation'){const entity={...part.entity,familyId:f.id};inserts.generations.push(entity);genMap.set(entity.id,entity);}if(part.kind==='tier'){const entity={...part.entity,generationId:g.id};inserts.tiers.push(entity);tierMap.set(entity.id,entity);}}
   const variantId=id('variant',source.id,t.id,r.outsole,r.constructionKey??r.recordId),colorwayId=id('color',source.id,g.id,r.constructionKey??r.recordId,identityName(r.colorway),r.swatch,[...r.colorNames].sort());
   if(!variantMap.has(variantId)){const v={id:variantId,tierModelId:t.id,generationId:g.id,surface:r.outsole,manufacturerOutsole:r.manufacturerOutsole};inserts.variants.push(v);variantMap.set(v.id,v);}
   if(!colorMap.has(colorwayId)){const c={id:colorwayId,generationId:g.id,name:r.colorway,swatch:r.swatch,colorNames:r.colorNames};inserts.colorways.push(c);colorMap.set(c.id,c);}
   if(variantColorPairs.has(key(variantId,colorwayId))){stage('POSSIBLE_MATCH','existing_variant_colorway_pair');continue;}
   const entryId=id('entry',source.id,r.recordId);const entry={id:entryId,slug:slug([r.brand,r.family,r.generation,r.tier,r.outsole??'unknown',r.colorway].join(' '),entryId),outsoleVariantId:variantId,generationId:g.id,colorwayId,sourceId:source.id,status:'DRAFT',sample:false,version:1};inserts.entries.push(entry);entries.set(entryId,entry);variantColorPairs.add(key(variantId,colorwayId));indexEntry(entry);row.entryId=entryId;row.variantId=variantId;
   if(r.sku){const s={entryId,brandId:b.id,region:r.skuRegion,value:r.sku,sourceId:source.id,sourceUrl:r.sourceUrl};inserts.identifiers.push(s);index(skus,key(b.id,r.skuRegion,r.sku),entryId);index(foldedSkus,key(b.id,r.skuRegion,r.sku.toLowerCase()),entryId);}
  }
  if(row.entryId&&row.action!=='NOOP'){const record={recordId:r.recordId,entryId:row.entryId,checksum:row.checksum!,identityHash:row.identityHash!,sourceUrl:r.sourceUrl,observedAt:r.observedAt};inserts.sourceRecords.push(record);records.set(record.recordId,record);}
 }
 const summary={total:rows.length,valid:rows.filter(r=>r.action!=='REJECT').length,invalid:rows.filter(r=>r.action==='REJECT').length,newRecords:rows.filter(r=>r.action==='CREATE_DRAFT').length,exactMatches:rows.filter(r=>r.outcome==='EXACT_MATCH').length,possibleMatches:rows.filter(r=>r.outcome==='POSSIBLE_MATCH').length,conflicts:rows.filter(r=>r.outcome==='CONFLICT').length,noops:rows.filter(r=>r.action==='NOOP').length,staged:rows.filter(r=>r.action==='STAGE'||r.action==='QUARANTINE').length};
 return {rows,inserts,summary,ready:summary.invalid===0,warnings:parsed.warnings,hash:digest({source,graph,rows:rows.map(({data,...row})=>({...row,dataHash:data?digest(data):null}))})};
}
export type PreparedImport=ReturnType<typeof prepareImport>;
