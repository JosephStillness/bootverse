import { describe, it, expect } from 'vitest';
import { normalizeObservation, compareClaims, isExplicitUnknown } from './observations';
import { qualityAssessment, freshnessPolicy } from './quality';
const context = { entryId: 'entry', sourceId: 'source', sourceUrl: 'https://example.test/evidence', observedAt: '2026-10-01T00:00:00Z' };
const observation = (value: unknown, attribute = 'weight') => normalizeObservation({ ...context, attribute, value, basis: 'REPORTED' });
describe('D3 observation normalization and context', () => {
    it('preserves terminology and original values while recording changes', () => { const r = observation('  Knit   upper  ', 'upperMaterial'); expect(r.value).toBe('Knit upper'); expect(r.originalObservation).toEqual({ value: '  Knit   upper  ', changes: ['text_whitespace'] }); });
    it('normalizes weight units with sample size and meaningful precision', () => { const r = observation({ amount: 0.20125, unit: 'kg', size: '8', sizeSystem: 'UK' }); expect(r.value).toEqual({ amount: 201.25, unit: 'g', size: '8', sizeSystem: 'UK' }); expect(r.originalObservation.changes).toContain('weight_unit'); });
    it('compares equivalent ounces and grams as equal', () => { expect(compareClaims('weight', { amount: 1, unit: 'oz', size: '8', sizeSystem: 'UK' }, { amount: 28.349523125, unit: 'g', size: '8', sizeSystem: 'UK' })).toBe('EQUIVALENT'); });
    it('does not flag different sizes or unknown methods as a contradiction', () => { expect(compareClaims('weight', { amount: 200, unit: 'g', size: '8', sizeSystem: 'UK' }, { amount: 210, unit: 'g', size: '9', sizeSystem: 'UK' })).toBe('DIFFERENT_CONTEXT'); expect(compareClaims('weight', { amount: 200, unit: 'g', size: '8', sizeSystem: 'UK', method: 'One shoe' }, { amount: 210, unit: 'g', size: '8', sizeSystem: 'UK' })).toBe('DIFFERENT_CONTEXT'); });
    it('flags a real contradiction in equal measurement context', () => { expect(compareClaims('weight', { amount: 200, unit: 'g', size: '8', sizeSystem: 'UK' }, { amount: 210, unit: 'g', size: '8', sizeSystem: 'UK' })).toBe('CONFLICT'); });
    it('keeps missing distinct from explicit unknown', () => { expect(isExplicitUnknown(observation(null, 'upperMaterial').value)).toBe(true); expect(() => observation(undefined, 'upperMaterial')).toThrow(); expect(compareClaims('upperMaterial', { unknown: true }, 'Synthetic material')).toBe('UNKNOWN'); });
    it('rejects unsupported units and missing sample context', () => { expect(() => observation({ amount: 1, unit: 'lb', size: '8', sizeSystem: 'UK' })).toThrow(); expect(() => observation({ amount: 200, unit: 'g' })).toThrow(); });
    it('preserves revision and rejects unsafe provenance', () => { expect(normalizeObservation({ ...context, sourceRevision: 'doc-v2', attribute: 'heelStructure', value: 'Synthetic support', basis: 'REPORTED' }).sourceRevision).toBe('doc-v2'); expect(() => normalizeObservation({ ...context, sourceUrl: 'https://example.test/?api_key=secret', attribute: 'heelStructure', value: 'x', basis: 'REPORTED' })).toThrow(); });
    it('accepts construction observations without inferring width or changing identity', () => { expect(observation('Synthetic toe construction', 'toeBoxConstruction').attribute).toBe('toeBoxConstruction'); expect(() => observation('wide', 'internalWidth')).toThrow(); });
});
describe('D3 quality and freshness', () => {
    const now = new Date('2026-10-24T00:00:00Z');
    const facts = { identityComplete: true, surfaceKnown: true, identityVerified: false, sourceAvailable: true, claims: [], images: [], offers: [], sourceCheckedAt: null };
    it('reports counts rather than an accuracy percentage and explains unknown identity', () => { const q = qualityAssessment(facts, now); expect(q.completeness.technicalPresent).toBe(0); expect(q.verification.unverifiedIdentity).toBe(true); expect(q.issues).toContain('identity_not_verified'); expect(q).not.toHaveProperty('accuracy'); });
    it('blocks unresolved conflicts and excludes unlicensed images', () => { const q = qualityAssessment({ ...facts, claims: [{ attribute: 'upperMaterial', status: 'CONFLICTED', value: 'x', observedAt: now, sourceId: 's' }], images: [{ status: 'VERIFIED', licenseStatus: 'UNKNOWN' }] }, now); expect(q.publication.ready).toBe(false); expect(q.verification.unresolvedConflicts).toBe(1); expect(q.completeness.authorizedImages).toBe(0); });
    it('does not equate completeness with verification', () => { const q = qualityAssessment({ ...facts, claims: [{ attribute: 'upperMaterial', status: 'UNVERIFIED', value: 'synthetic', observedAt: now, sourceId: 's' }] }, now); expect(q.completeness.technicalPresent).toBe(1); expect(q.verification.reviewedClaims).toBe(0); });
    it('uses separate freshness windows without declaring old evidence false', () => { expect(freshnessPolicy({ PRODUCT_FRESHNESS_PRICE_DAYS: '2' }).priceDays).toBe(2); const q = qualityAssessment({ ...facts, offers: [{ kind: 'PRICE', observedAt: new Date('2026-10-01'), validUntil: new Date('2026-10-25') }] }, now); expect(q.stale.some(s => s.kind === 'PRICE')).toBe(true); expect(q.issues).toContain('source_check_missing'); });
});
it('public assets exclude unknown rights and select primary deterministically', async () => {
    const { publicAssets } = await import('./public');
    const source = { status: 'ACTIVE', authorizationStatus: 'GRANTED' };
    const base = { id: 'a', status: 'VERIFIED', licenseStatus: 'GRANTED', reviewedAt: new Date(), permissionNotes: 'Synthetic permission', permissionUrl: 'https://example.test/license', source, sortOrder: 2, isPrimary: false, externalUrl: 'https://example.test/authorized.webp', uploadedImage: null, uploadedImageId: null, attribution: 'Synthetic owner', altText: 'Synthetic photo', sourceUrl: 'https://example.test/photo' };
    expect(publicAssets([{ ...base, licenseStatus: 'UNKNOWN' }])).toEqual([]);
    expect(publicAssets([base, { ...base, id: 'b', isPrimary: true, sortOrder: 3 }]).map(i => i.id)).toEqual(['b', 'a']);
});
it('normalizes known outsole labels and records the manufacturer wording', () => {
    const r = observation('AG-Pro', 'normalizedOutsoleCategory');
    expect(r.value).toBe('AG');
    expect(r.originalObservation).toEqual({ value: 'AG-Pro', changes: ['outsole_label'] });
    expect(() => observation('marsh', 'normalizedOutsoleCategory')).toThrow();
});
it('requires documentary rights for permission grants and rejects unknown update fields',async()=>{
 const {assetRightsSchema}=await import('./contracts');
 expect(assetRightsSchema.safeParse({version:1,licenseStatus:'GRANTED',permissionNotes:null,permissionUrl:null,note:'Synthetic permission decision'}).success).toBe(false);
 expect(assetRightsSchema.safeParse({version:1,licenseStatus:'GRANTED',permissionNotes:'Synthetic owner permission',permissionUrl:'https://example.test/license',note:'Synthetic permission decision'}).success).toBe(true);
 expect(assetRightsSchema.safeParse({version:1,licenseStatus:'GRANTED',permissionNotes:'Synthetic owner permission',permissionUrl:'https://example.test/license',note:'Synthetic permission decision',status:'VERIFIED'}).success).toBe(false);
});
