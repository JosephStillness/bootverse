import {it,expect} from 'vitest';
import {addComparison,comparisonHref,parseComparisonIds} from './comparison';
const entry=(n:number,variantId=`v${n}`)=>({entryId:`e${n}`,variantId,label:`Boot ${n}`});
it('prevents duplicate exact variants even across colorways',()=>{
 expect(addComparison([entry(1)],entry(2,'v1'))).toEqual([entry(1)]);
});
it('allows different tiers/outsoles and caps selection at four',()=>{
 let selected=[entry(1)];for(let n=2;n<=5;n++)selected=addComparison(selected,entry(n));
 expect(selected.map(b=>b.entryId)).toEqual(['e1','e2','e3','e4']);
});
it('round trips safe entry IDs and rejects oversized/malformed query selections',()=>{
 expect(comparisonHref([entry(1),entry(2)])).toBe('/compare?boot=e1&boot=e2');
 expect(parseComparisonIds(new URLSearchParams('boot=e1&boot=e1&boot=e2'))).toEqual(['e1','e2']);
 expect(()=>parseComparisonIds(new URLSearchParams('boot=../../secret'))).toThrow();
 expect(()=>parseComparisonIds(new URLSearchParams('boot=1&boot=2&boot=3&boot=4&boot=5'))).toThrow();
});
