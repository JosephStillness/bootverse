import {z} from 'zod';
export const MAX_COMPARISON=4;
export interface ComparisonSelection {entryId:string;variantId:string;label:string}
export function addComparison(current:ComparisonSelection[],entry:ComparisonSelection){
 return current.length>=MAX_COMPARISON||current.some(b=>b.variantId===entry.variantId)?current:[...current,entry];
}
export function comparisonHref(entries:ComparisonSelection[]){
 const params=new URLSearchParams();for(const entry of entries)params.append('boot',entry.entryId);
 return `/compare${params.size?`?${params}`:''}`;
}
export function parseComparisonIds(params:URLSearchParams){
 return [...new Set(z.array(z.string().regex(/^[\p{L}\p{N}_-]{1,120}$/u)).max(MAX_COMPARISON).parse(params.getAll('boot')))];
}
