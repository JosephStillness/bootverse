import {z} from 'zod';
import {claimSchema,productImageSchema,offerSchema} from '@/lib/product-data/validation';
import {recordSchema} from './schemas';
import {ImportInputError} from './types';
export const identityName=(value:string)=>value.trim().normalize('NFC').replace(/\s+/gu,' ').toLowerCase();
const brandAliases:Record<string,string>={'nike':'Nike','nike inc.':'Nike','adidas':'Adidas','adidas performance':'Adidas','puma':'Puma','mizuno':'Mizuno','new balance':'New Balance','newbalance':'New Balance'};
const tiers:Record<string,string>={elite:'Elite',pro:'Pro',academy:'Academy',league:'League',club:'Club',ultimate:'Ultimate',match:'Match'};
const outsoleAliases:Record<string,string>={fg:'FG',firmground:'FG',ag:'AG',agpro:'AG',artificialgrass:'AG',sg:'SG',softground:'SG',tf:'TF',turf:'TF',in:'IN',ic:'IN',indoor:'IN',mg:'MG',multiground:'MG',fgag:'MG',other:'OTHER'};
export function normalizeOutsole(raw:string|null|undefined){if(!raw||/^(unknown|unspecified|n\/a)$/i.test(raw.trim()))return null;const value=outsoleAliases[raw.toLowerCase().replace(/[^a-z]/g,'')];if(!value)throw new ImportInputError('invalid_outsole');return value as 'FG'|'AG'|'SG'|'TF'|'IN'|'MG'|'OTHER';}
const object=z.record(z.string(),z.unknown());
export function normalizeRecord(input:unknown,sourceId:string){
 const r=recordSchema.parse(input);
 if(/^(unknown|unverified)$/i.test(r.tier))throw new ImportInputError('unknown_tier');
 const context={sourceId,sourceUrl:new URL(r.sourceUrl).href,observedAt:new Date(r.observedAt).toISOString()};
 const specifications=r.specifications.map(raw=>{
  const fields=object.parse(raw);if('sourceId'in fields||'sourceUrl'in fields||'entryId'in fields||'variantId'in fields||'observedAt'in fields)throw new ImportInputError('specification_scope');
  let value=fields.value===null?{unknown:true}:fields.value;
  if(fields.attribute==='weight'&&typeof value==='object'&&value!==null&&!('unknown' in value)){const weight={...object.parse(value)};const units:Record<string,string>={g:'g',grams:'g',oz:'oz',ounces:'oz',kg:'g',kilograms:'g'};const unit=String(weight.unit).toLowerCase();weight.unit=units[unit]??unit;if(['kg','kilograms'].includes(unit)&&typeof weight.amount==='number')weight.amount=Number((weight.amount*1000).toPrecision(12));value=weight;}
  const checked=claimSchema.parse({...context,entryId:'import-preview',...fields,value});
  return {attribute:checked.attribute,value:checked.value,basis:checked.basis,notes:checked.notes??null};
 });
 if(new Set(specifications.map(s=>s.attribute)).size!==specifications.length)throw new ImportInputError('duplicate_attribute');
 const images=r.images.map(raw=>{const fields=object.parse(raw);if('sourceId'in fields)throw new ImportInputError('image_source');return productImageSchema.parse({sourceUrl:context.sourceUrl,...fields,sourceId});});
 if(images.filter(i=>i.isPrimary).length>1)throw new ImportInputError('multiple_primary_images');
 const offers=r.offers.map(raw=>{const fields=object.parse(raw);if('sourceId'in fields)throw new ImportInputError('offer_source');return offerSchema.parse({...fields,sourceId});});
 return {...r,brand:brandAliases[identityName(r.brand)]??r.brand,tier:tiers[identityName(r.tier)]??r.tier,outsole:normalizeOutsole(r.outsole),
  manufacturerOutsole:r.manufacturerOutsole??r.outsole?.trim().normalize('NFC')??null,sku:r.sku?.normalize('NFC')??null,constructionKey:r.constructionKey??null,
  swatch:r.swatch?.toLowerCase()??null,colorNames:r.colorNames, ...context,specifications,images,offers,
  rawIdentity:{brand:r.brand,family:r.family,generation:r.generation,tier:r.tier,outsole:r.outsole??null,colorway:r.colorway},
 };
}
export type CanonicalProduct=ReturnType<typeof normalizeRecord>;
