import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {BootFitFinder} from './finder';
import {FinderResultCard} from './finder-results';
import {boots} from '@/lib/boots/data';
import {recommend} from '@/lib/recommendations/engine';
import {normalizeProfile} from '@/lib/recommendations/normalize';
import {analyzeReviews} from '@/lib/recommendations/review-analysis';
import type {Candidate} from '@/lib/recommendations/types';
const boot=boots[0];
const candidate:Candidate={variantId:boot.variant.id,generationId:boot.generation.id,generation:boot.generation.name,familyId:boot.family.id,family:boot.family.name,brandId:boot.brand.id,brand:boot.brand.name,tierId:boot.tier.id,tier:boot.tier.name,outsole:boot.variant.surface,entry:{id:boot.id,slug:boot.slug,colorwayId:boot.colorwayId,colorway:boot.colorway.name},sample:true,evidence:[]};
const p=normalizeProfile({version:0,surface:'FG'});
const ranked=recommend(p,[candidate],'2026-10-16T00:00:00Z').unverified[0];
const result={...ranked,catalogue:{entryId:boot.id,slug:boot.slug,variantId:boot.variant.id,generationId:boot.generation.id,colorwayId:boot.colorwayId,brandId:boot.brand.id,tier:boot.tier.name,outsole:boot.variant.surface}};
describe('finder privacy and explainable presentation',()=>{
 it('lets guests discover the product without collecting private dimensions or pretending guest queries work',()=>{const html=renderToStaticMarkup(<BootFitFinder authenticated={false}/>);expect(html).toContain('Guest recommendation queries are not supported');expect(html).toContain('/login?callbackUrl=');expect(html).not.toContain('name="leftLengthMm"');expect(html).toContain('not guaranteed physical fit');});
 it('loads authenticated data through the private API rather than embedding a saved profile in initial HTML',()=>{const html=renderToStaticMarkup(<BootFitFinder authenticated/>);expect(html).toContain('Loading your private saved profile');expect(html).not.toContain('revision');});
 it('shows real sample uncertainty and only existing exact detail/review links',()=>{const html=renderToStaticMarkup(<FinderResultCard result={result}/>);expect(html).toContain('Verified price unavailable');expect(html).toContain('Unverified catalogue entry');expect(html).toContain(`/boots/${boot.slug}#reviews`);expect(html).toContain('Concept artwork');expect(html).not.toContain('97% match');expect(html).toContain('Compare this variant');});
 it('hides numerical ranking scores when requested-factor coverage is insufficient',()=>{const html=renderToStaticMarkup(<FinderResultCard result={{...result,sample:false,surfaceStatus:'compatible',preferenceScore:100,evidenceCoverage:20}} rank={1}/>);expect(html).not.toContain('Preference-ranking score: 100');expect(html).toContain('no numerical ranking score shown');expect(html).toContain('No verified product image');});
 it('does not turn withheld review counts into zeros or expose raw reviewer records',()=>{const analysis=analyzeReviews(result.variantId,p,[],'Sample configuration.');const html=renderToStaticMarkup(<FinderResultCard result={{...result,reviewAnalysis:analysis}}/>);expect(html).toContain('Withheld for privacy');expect(html).not.toContain('authorId');expect(html).not.toContain('footLengthCm');});
 it('does not invent a public product route for a mismatched exact variant',()=>{const html=renderToStaticMarkup(<FinderResultCard result={{...result,variantId:'another-generation'}}/>);expect(html).toContain('public detail page is not available');expect(html).not.toContain('View Boot Details');});
});

it('withholds catalogue actions when colorway identity or outsole metadata no longer matches',()=>{
 for(const patch of [{entry:{...result.entry,colorwayId:'different-colorway'}},{outsole:'AG' as const}]){
  const html=renderToStaticMarkup(<FinderResultCard result={{...result,...patch}}/>);
  expect(html).not.toContain('View Boot Details');
 }
});
