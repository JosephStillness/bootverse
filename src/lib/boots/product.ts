import {z} from 'zod';
import type {BootEntry} from './types';
const attribute=z.object({status:z.literal('verified'),value:z.string().trim().min(1).max(300),sourceUrl:z.url().refine(value=>{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!Array.from(u.searchParams.keys()).some(k=>/token|secret|signature|api.?key/i.test(k));}),observedAt:z.iso.datetime()}).strict();
// These fields are operator-curated technical claims. Reviews, fit and scoped offers have separate sources.
const specs=z.object({upper:attribute.optional(),weight:attribute.optional(),releaseDate:attribute.optional()}).strict();
export function productSpecifications(sample:boolean,input:unknown):BootEntry['specifications']{
 const unknown={status:'unknown' as const,reason:sample?'Not verified for this sample entry.':'No sourced specification is stored for this exact configuration.'};
 const parsed=sample?null:specs.safeParse(input);
 return {upper:unknown,weight:unknown,releaseDate:unknown,price:unknown,fit:unknown,rating:unknown,endorsements:unknown,...(parsed?.success?parsed.data:{})};
}

import {parseEvidence,fresh} from '@/lib/recommendations/evidence';
import {rules} from '@/lib/recommendations/config';
export function productOffers(sample:boolean,entryId:string,rows:unknown[],asOf=new Date().toISOString()){
 if(sample||rows.length>32)return [];
 return rows.flatMap(row=>{const e=parseEvidence(row);return e?.kind==='PRICE'&&['MANUFACTURER','RETAILER'].includes(e.sourceKind)&&e.payload.entryId===entryId&&fresh(e,Date.parse(asOf),rules.priceMaxAgeDays)?[{...e.payload,sourceUrl:e.sourceUrl,observedAt:e.observedAt}]:[];}).slice(0,8);
}
