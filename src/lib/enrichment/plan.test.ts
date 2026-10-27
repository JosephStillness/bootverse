import { it, expect } from 'vitest';
import { prepareEnrichment } from './plan';
const raw = { entryId: 'entry', variantId: 'FG-Elite', sourceUrl: 'https://example.test/fixture', observedAt: '2026-10-01T00:00:00Z', specifications: [{ attribute: 'upperMaterial', value: 'Synthetic new', basis: 'REPORTED' }], images: [] };
const source = { id: 'source', version: 1 };
const target = { id: 'entry', outsoleVariantId: 'FG-Elite', version: 1, claims: [{ id: 'old', attribute: 'upperMaterial', value: 'Synthetic verified', status: 'VERIFIED', sourceUrl: 'https://example.test/old' }], productImages: [] };
it('retains conflicting incoming observations and references without overwriting verified data', () => { const p = prepareEnrichment([raw], source, [target]); expect(p.ready).toBe(true); expect(p.rows[0].claims[0].status).toBe('CONFLICTED'); expect(p.rows[0].claims[0].conflicts[0]).toMatchObject({ id: 'old', sourceUrl: 'https://example.test/old' }); expect(target.claims[0].value).toBe('Synthetic verified'); });
it('does not create variants or cross FG/AG or tier identity', () => { expect(prepareEnrichment([{ ...raw, variantId: 'AG-Elite' }], source, [target]).ready).toBe(false); expect(prepareEnrichment([{ ...raw, variantId: 'FG-Pro' }], source, [target]).ready).toBe(false); expect(prepareEnrichment([raw], source, []).ready).toBe(false); });
it('deduplicates exact observations across rows and preserves same-size contextual non-conflicts', () => { const p = prepareEnrichment([raw, raw], source, [{ ...target, claims: [] }]); expect(p.rows[0].claims[0].duplicate).toBe(false); expect(p.rows[1].claims[0].duplicate).toBe(true); });
it('never proposes publication or identity edits and hashes existing state', () => { const p = prepareEnrichment([raw], source, [target]); expect(p).not.toHaveProperty('publication'); expect(p.hash).not.toBe(prepareEnrichment([raw], source, [{ ...target, version: 2 }]).hash); });
it('flags a sourced outsole contradiction without changing the exact construction',()=>{
 const p=prepareEnrichment([{...raw,specifications:[{attribute:'normalizedOutsoleCategory',value:'AG-Pro',basis:'REPORTED'}]}],source,[{...target,surface:'FG'}]);expect(p.rows[0].variantId).toBe('FG-Elite');expect(p.rows[0].claims[0].status).toBe('CONFLICTED');
});
it('deduplicates the same observation instant expressed in different UTC offsets',()=>{
 const p=prepareEnrichment([raw,{...raw,observedAt:'2026-10-01T07:00:00+07:00'}],source,[{...target,claims:[]}]);expect(p.rows[1].claims[0].duplicate).toBe(true);
});
