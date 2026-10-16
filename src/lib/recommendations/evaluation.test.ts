import {it,expect} from 'vitest';
import {evaluationCandidates,evaluationScenarios,evaluationTime} from '../../../tests/fixtures/recommendation-evaluation';
import {recommend} from './engine';
import {analyzeReviews} from './review-analysis';
it.each(evaluationScenarios)('scenario $id: $description',({id,preferences:p})=>{
 const candidates=evaluationCandidates();const result=recommend(p,candidates,evaluationTime,20);
 expect(result).toEqual(recommend(p,candidates.toReversed(),evaluationTime,20));
 expect(result.eligible.length).toBeGreaterThan(0);
 expect(new Set(result.eligible.map(r=>r.variantId)).size).toBe(result.eligible.length);
 for(const row of result.eligible){
  expect(row.outsole).toBe(p.surface);expect(row.surfaceStatus).toBe('compatible');expect(row.physicalFit).toBe('unknown');
  expect(row.reasons.join(' ')).toContain('Exact-variant manufacturer');expect(row.unknowns.join(' ')).toContain('Physical fit');
  expect(row.cautions.join(' ')).toContain('not a scientifically validated');
  expect(row.sources.length).toBeGreaterThan(0);
  if(row.preferenceScore!==null){expect(row.preferenceScore).toBeGreaterThanOrEqual(0);expect(row.preferenceScore).toBeLessThanOrEqual(100);}
  expect(analyzeReviews(row.variantId,p,[]).overall).toBeNull();
 }
 if(['C','H'].includes(id))expect(result.eligible.every(r=>r.budgetStatus==='over')).toBe(true);
 if(id==='I')expect(result.eligible.every(r=>r.budgetStatus==='unknown'&&r.price?.currency==='AUD'&&r.preferenceScore===null)).toBe(true);
 if(id==='E')expect(result.eligible.every(r=>r.factors.find(f=>f.name==='fit')?.match===null&&r.evidenceCoverage<100)).toBe(true);
 if(id==='F')expect(result.eligible.every(r=>analyzeReviews(r.variantId,p,[]).similar===null)).toBe(true);
 if(id==='G')expect(result.eligible.every(r=>!r.factors.find(f=>f.name==='brandTier')?.applicable)).toBe(true);
 if(id==='J')expect(result.eligible.every(r=>analyzeReviews(r.variantId,p,[]).quality==='Insufficient Evidence')).toBe(true);
});
it('keeps missing, stale, contradictory and sample eligibility out of recommendations',()=>{
 const p=evaluationScenarios[0].preferences;
 const rows=evaluationCandidates(4);
 rows[0].evidence=[];rows[1].evidence.forEach(e=>{e.validUntil='2026-10-15T00:00:00Z';});rows[2].sample=true;
 const source=rows[3].evidence[0];if(source.kind==='SURFACE')rows[3].evidence.push({...source,id:'denial',payload:{...source.payload,denied:['AG']}});
 const result=recommend(p,rows,evaluationTime);expect(result.eligible).toHaveLength(0);expect(result.counts.excluded).toBe(1);
});
