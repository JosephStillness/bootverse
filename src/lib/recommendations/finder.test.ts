import {describe,it,expect} from 'vitest';
import {finderPreferencesSchema,emptyFinder,saveFinderPayload,filterResults,defaultRefinements,catalogueReference} from './finder';
import {normalizeProfile} from './normalize';
import {recommend} from './engine';
import type {Candidate} from './types';
const fixture=(id:string):Candidate=>({variantId:id,generationId:'test-generation',generation:'Test generation',familyId:'family',family:'Test family',brandId:'nike',brand:'Nike',tierId:'elite',tier:'Elite',outsole:'AG',entry:{id:'test-entry',slug:'test-entry',colorwayId:'color',colorway:'Test'},sample:false,evidence:[{id:'test-surface',kind:'SURFACE',sourceKind:'MANUFACTURER',sourceUrl:'https://www.nike.com/test-only',observedAt:'2026-10-14T00:00:00Z',validUntil:'2026-10-30T00:00:00Z',payload:{outsole:'AG',allowed:['AG'],denied:[]}}]});
const values={...emptyFinder(),surface:'AG' as const,leftLengthMm:'270',rightLengthMm:'269',leftWidthMm:'100',rightWidthMm:'99'};
describe('finder request and saved profile boundaries',()=>{
 it('requires an explicit surface and rejects IDs, saved consent and calculated results',()=>{expect(finderPreferencesSchema.safeParse(emptyFinder()).success).toBe(false);expect(finderPreferencesSchema.parse(values).surface).toBe('AG');for(const extra of [{userId:'other'},{version:1},{allowFitFinder:true},{preferenceScore:100}])expect(finderPreferencesSchema.safeParse({...values,...extra}).success).toBe(false);});
 it('uses existing measurement, international currency and paired-size validation',()=>{for(const patch of [{leftLengthMm:'NaN'},{leftWidthMm:'200'},{budgetAmount:'100',currency:null},{budgetAmount:'100',currency:'ZZZ'},{sizeWorn:'9',sizeSystem:null}])expect(finderPreferencesSchema.safeParse({...values,...patch}).success).toBe(false);const parsed=finderPreferencesSchema.parse({...values,unit:'cm',leftLengthMm:'27',rightLengthMm:'26.9',leftWidthMm:'10',rightWidthMm:'9.9',budgetAmount:'100',currency:'VND'});expect(normalizeProfile({...parsed,version:0}).leftLengthMm).toBe('270');});
 it('creates a saved payload only explicitly with existing profile concurrency and unrelated fields preserved',()=>{const existing={version:3,revision:'own-row',arch:'High',measurementMethod:'Old method',measuredOn:'2026-01-01',leftLengthMm:'270',rightLengthMm:'269',leftWidthMm:'100',rightWidthMm:'99'};const payload=saveFinderPayload(values,existing);expect(payload).toMatchObject({version:3,revision:'own-row',arch:'High',allowFitFinder:true,measurementMethod:'Old method'});const changed=saveFinderPayload({...values,leftLengthMm:'271'},existing);expect(changed.measurementMethod).toBeNull();expect(changed.measuredOn).toBeNull();expect(saveFinderPayload(values,null).revision).toBeNull();});
});
describe('finder result refinements',()=>{
 const p=normalizeProfile({version:0,surface:'AG',preferredBrands:['nike']});
 const data=recommend(p,[fixture('one'),fixture('two')],'2026-10-15T00:00:00Z');
 it('preserves engine order and does not mutate scores or promote unverified products',()=>{const before=JSON.stringify(data);expect(filterResults(data.eligible,defaultRefinements).map(r=>r.variantId)).toEqual(data.eligible.map(r=>r.variantId));expect(filterResults(data.eligible,{...defaultRefinements,tier:'Academy'})).toEqual([]);expect(JSON.stringify(data)).toBe(before);});
 it('does not misclassify unknown budget or withheld reviews as confirmed matches',()=>{expect(filterResults(data.eligible,{...defaultRefinements,budget:'within'})).toHaveLength(0);expect(filterResults(data.eligible,{...defaultRefinements,reviews:'available'})).toHaveLength(0);});
 it('only connects catalogue actions when the exact variant/generation/entry is known',()=>{expect(catalogueReference(data.eligible[0])).toBeNull();});
});

describe('authenticated recommendation request contract',()=>{
 it('retains saved-profile mode and requires explicit transient processing permission',async()=>{
  const {recommendationRequest}=await import('./request');
  expect(recommendationRequest.parse({limit:1}).preferences).toBeUndefined();
  expect(recommendationRequest.safeParse({preferences:values}).success).toBe(false);
  expect(recommendationRequest.safeParse({preferences:values,processingConsent:true}).success).toBe(true);
  for(const extra of [{userId:'other'},{saveProfile:true},{processingConsent:'true'}])expect(recommendationRequest.safeParse({preferences:values,processingConsent:true,...extra}).success).toBe(false);
 });
});

it('validates steps independently while enforcing all fields at review',async()=>{
 const {finderStepErrors}=await import('./finder');
 expect(finderStepErrors(emptyFinder(),0)).toEqual({});
 expect(finderStepErrors(emptyFinder(),1).surface).toBeDefined();
 expect(finderStepErrors({...values,budgetAmount:'100'},0)).toEqual({});
 expect(finderStepErrors({...values,budgetAmount:'100'},2).currency).toBeDefined();
 expect(finderStepErrors({...values,leftLengthMm:'garbage'},3).leftLengthMm).toBeDefined();
});
