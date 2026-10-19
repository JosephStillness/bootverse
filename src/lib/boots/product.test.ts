import {it,expect} from 'vitest';
import {productSpecifications} from './product';
const upper={status:'verified',value:'Synthetic QA material',sourceUrl:'https://example.test/manufacturer',observedAt:'2026-10-17T00:00:00Z'};
it('preserves unknowns and only exposes sourced technical attributes',()=>{
 expect(productSpecifications(false,{upper}).upper).toEqual(upper);
 expect(productSpecifications(false,{upper:{...upper,sourceUrl:'javascript:alert(1)'}}).upper.status).toBe('unknown');
 expect(productSpecifications(false,{rating:upper}).rating.status).toBe('unknown');
});
it('never upgrades sample specifications to verified manufacturer claims',()=>{
 expect(productSpecifications(true,{upper}).upper.status).toBe('unknown');
});

import {productOffers} from './product';
const offer={id:'qa-price',kind:'PRICE',sourceKind:'RETAILER',sourceUrl:'https://example.test/offer',observedAt:'2026-10-17T00:00:00Z',validUntil:'2026-10-18T00:00:00Z',payload:{entryId:'entry-a',amount:'100',currency:'AUD',size:'9',sizeSystem:'UK'}};
it('keeps prices exact-entry/size scoped, sourced and fresh; samples never become offers',()=>{
 expect(productOffers(false,'entry-a',[offer],'2026-10-17T01:00:00Z')).toMatchObject([{amount:'100',currency:'AUD',size:'9',sizeSystem:'UK'}]);
 expect(productOffers(false,'other-entry',[offer],'2026-10-17T01:00:00Z')).toEqual([]);
 expect(productOffers(true,'entry-a',[offer],'2026-10-17T01:00:00Z')).toEqual([]);
 expect(productOffers(false,'entry-a',[offer],'2026-10-19T00:00:00Z')).toEqual([]);
});
