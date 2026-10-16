import {describe,it,expect} from 'vitest';
import {analyzeReviews,type AnalysisReview} from './review-analysis';
const p={leftLengthMm:'270',rightLengthMm:'269',leftWidthMm:'100',rightWidthMm:'99',footShape:'Regular',instep:null,fitSensation:null,sizeSystem:'UK',sizeWorn:'9'};
const row=(n:number,patch:Partial<AnalysisReview>={}):AnalysisReview=>({id:`r${n}`,authorId:`u${n}`,variantId:'v1',status:'PUBLISHED',author:{status:'ACTIVE',emailVerified:new Date(),profile:{}},shareFootInfo:true,analysisConsent:true,analysisConsentAt:new Date(),footLengthCm:27,footWidthCm:10,footShape:'average',reviewInstep:null,reviewFitSensation:null,sizeSystem:'UK',sizeWorn:'9.0',fit:4,comfort:5,widthObservation:'expected',toeRoomCategory:'expected',heelLockdownCategory:'secure',breakInCategory:'none',sponsorship:null,...patch});
const rows=(n:number)=>Array.from({length:n},(_,i)=>row(i));
describe('privacy-preserving exact variant review analysis',()=>{
 it('reports no evidence without inventing ratings',()=>{const a=analyzeReviews('v1',p,[]);expect(a.counts).toEqual({eligible:0,similar:0});expect(a.overall).toBeNull();expect(a.quality).toBe('Insufficient Evidence');});
 it.each([1,2,4])('suppresses small group of %s including similarity and distributions',n=>{const a=analyzeReviews('v1',p,rows(n));expect(a.counts).toEqual({eligible:null,similar:null});expect(a.overall).toBeNull();expect(a.similar).toBeNull();expect(a.similarity).toBeNull();});
 it('uses independent authors once and never treats edits as additional evidence',()=>{const data=rows(5);const a=analyzeReviews('v1',p,[...data,data[0],row(99,{authorId:'u0'})]);expect(a.counts.eligible).toBe(5);expect(a.overall?.fitMean).toBe(4);});
 it('filters hidden/spam, missing consent, withdrawn sharing and inactive authors',()=>{for(const patch of [{status:'HIDDEN'},{status:'DELETED'},{analysisConsent:false},{analysisConsentAt:null},{shareFootInfo:false},{author:{status:'SUSPENDED',emailVerified:new Date(),profile:{}}},{fit:6}] as Partial<AnalysisReview>[]){expect(analyzeReviews('v1',p,[row(1,patch)]).counts.eligible).toBe(0);}});
 it('does not mix variants, tiers, generations or outsoles and applies exact size/system to similar group',()=>{expect(analyzeReviews('v2',p,rows(5)).counts.eligible).toBe(0);for(const patch of [{sizeSystem:'US'},{sizeWorn:'10'}]){const a=analyzeReviews('v1',p,rows(5).map(x=>({...x,...patch})));expect(a.counts).toEqual({eligible:5,similar:0});}expect(analyzeReviews('v1',{...p,sizeWorn:null},rows(5)).counts.similar).toBe(0);});
 it('calculates real means and distributions with sufficient cells',()=>{const a=analyzeReviews('v1',p,[...rows(5),...rows(5).map((x,i)=>({...x,id:`b${i}`,authorId:`b${i}`,fit:2,comfort:3,widthObservation:'too-narrow'}))]);expect(a.overall?.fitMean).toBe(3);expect(a.overall?.comfortMean).toBe(4);expect(a.overall?.fitDistribution).toEqual({'2':5,'4':5});expect(a.conflicts.length).toBeGreaterThan(0);expect(a.quality).toBe('Limited Evidence');});
 it('suppresses entire sparse distributions and complementary groups',()=>{const a=analyzeReviews('v1',p,rows(6).map((r,i)=>({...r,fit:i===0?1:4})));expect(a.overall?.fitDistribution).toBeNull();const b=analyzeReviews('v1',p,rows(6).map((r,i)=>({...r,footLengthCm:i===0?30:27})));expect(b.counts.eligible).toBe(6);expect(b.counts.similar).toBeNull();expect(b.similar).toBeNull();});
 it('counts missing measurements in overall only and does not fetch or infer private profiles',()=>{const a=analyzeReviews('v1',p,rows(5).map(r=>({...r,footLengthCm:null})));expect(a.counts).toEqual({eligible:5,similar:0});expect(a.similarity).toBeNull();});
 it('has transparent moderate/stronger thresholds and no individual measurements/identities in DTO',()=>{expect(analyzeReviews('v1',p,rows(10)).quality).toBe('Moderate Evidence');const a=analyzeReviews('v1',{...p,instep:'High',fitSensation:'Cushioned'},rows(30).map(r=>({...r,reviewInstep:'High',reviewFitSensation:'Cushioned'})));expect(a.quality).toBe('Stronger Evidence');const s=JSON.stringify(a);for(const key of ['authorId','footLengthCm','footWidthCm','reviewInstep','u0','r0'])expect(s).not.toContain(`"${key}"`);});
 it('fails closed for bounded overflow and sample catalogue entries',()=>{for(const reason of ['Scan limit reached.','Sample catalogue configuration.']){const a=analyzeReviews('v1',p,rows(50),reason);expect(a.counts.eligible).toBeNull();expect(a.overall).toBeNull();expect(a.warnings).toContain(reason);}});
 it('is deterministic on shuffled input and bounded large sets',()=>{expect(analyzeReviews('v1',p,rows(200))).toEqual(analyzeReviews('v1',p,rows(200).reverse()));});
});

it("withholds an overflowing direct analysis rather than computing unbounded partial evidence",()=>{
 expect(analyzeReviews('v1',p,rows(2001)).overall).toBeNull();
});
it("excludes disclosed sponsored content from independent evidence",()=>{
 expect(analyzeReviews('v1',p,rows(5).map(r=>({...r,sponsorship:'Paid test fixture'}))).counts.eligible).toBe(0);
});
