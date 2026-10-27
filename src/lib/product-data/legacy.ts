import {productSpecifications} from '@/lib/boots/product';
// Legacy source-attributed values are protected, without inventing registry verification.
export function legacyObservations(entry:{id:string;sample:boolean;specifications:unknown}){
 const legacy=productSpecifications(entry.sample,entry.specifications);
 return ([['upper','upperMaterial'],['releaseDate','releaseDate']] as const).flatMap(([field,attribute])=>{
  const value=legacy[field];return value.status==='verified'?[{id:`legacy:${entry.id}:${attribute}`,entryId:entry.id,variantId:null,attribute,value:value.value,status:'VERIFIED',sourceUrl:value.sourceUrl,observationKey:null}]:[];
 });
}
