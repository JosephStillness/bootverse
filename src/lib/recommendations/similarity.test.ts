import {describe,it,expect} from 'vitest';
import {normalizeProfile} from './normalize';
import {reviewerSimilarity,cmToMm} from './similarity';
const profile={leftLengthMm:'270',rightLengthMm:'268',leftWidthMm:'100',rightWidthMm:'99',footShape:'Regular',instep:null,fitSensation:null};
const reviewer={lengthMm:270,widthMm:100,footShape:'average',instep:null,fitSensation:null};
describe('experimental reviewer similarity',()=>{
 it('normalizes review cm without treating a missing value as zero',()=>{expect(cmToMm(27.1,'length')).toBe(271);for(const n of [null,NaN,Infinity,-1,0,41])expect(cmToMm(n,'length')).toBeNull();expect(cmToMm(3,'width')).toBe(30);});
 it('matches exact maximum dimensions and self-reported shape',()=>{expect(reviewerSimilarity(profile,reviewer)).toMatchObject({similar:true,score:100});});
 it('distinguishes close, boundary and distant dimensions',()=>{expect(reviewerSimilarity(profile,{...reviewer,lengthMm:272}).similar).toBe(true);expect(reviewerSimilarity(profile,{...reviewer,lengthMm:276}).similar).toBe(false);expect(reviewerSimilarity(profile,{...reviewer,lengthMm:275,widthMm:105}).similar).toBe(false);});
 it('requires both bilateral dimensions and does not infer missing categories',()=>{expect(reviewerSimilarity({...profile,leftWidthMm:null},reviewer).score).toBeNull();expect(reviewerSimilarity({...profile,footShape:null},{...reviewer,footShape:null})).toMatchObject({similar:true,score:100,completeness:0.8});});
 it('uses optional shared traits without turning missing or unsure into disagreement',()=>{expect(reviewerSimilarity(profile,{...reviewer,instep:'High'}).score).toBe(100);expect(reviewerSimilarity({...profile,footShape:'Wide'},reviewer).score).toBeLessThan(100);expect(reviewerSimilarity({...profile,footShape:'Unsure'},reviewer).score).toBe(100);});
 it('rejects malformed normalized requester numbers and supports configurable bands',()=>{expect(reviewerSimilarity({...profile,leftLengthMm:'270oops'},reviewer).similar).toBe(false);expect(reviewerSimilarity(profile,{...reviewer,lengthMm:272},{lengthBandMm:1,widthBandMm:5,minScore:50}).similar).toBe(false);});
});

it('matches identically after cm/mm profile normalization',()=>{
 const cm=normalizeProfile({version:0,unit:'cm',leftLengthMm:'27',rightLengthMm:'26.8',leftWidthMm:'10',rightWidthMm:'9.9'});
 expect(reviewerSimilarity(cm,reviewer)).toEqual(reviewerSimilarity({...profile,footShape:null},reviewer));
});
