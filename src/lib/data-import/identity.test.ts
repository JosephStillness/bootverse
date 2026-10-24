import {it,expect} from 'vitest';
import {prepareImport,emptyGraph} from './preview';
const product={recordId:'synthetic-1',brand:'Synthetic brand',family:'Synthetic family',generation:'Synthetic gen',tier:'Elite',outsole:'FG',colorway:'Synthetic blue',sku:'SyntheticSKU',sourceUrl:'https://example.test/product',observedAt:'2026-10-01T00:00:00Z'};
const source={id:'source',name:'Synthetic source',type:'MANUAL_RESEARCH',version:1,brandId:null};
const input=(products:unknown[])=>({sourceId:'source',format:'JSON' as const,content:JSON.stringify({version:1,products}),mapping:{}});
it('creates deterministic separate draft identities, not display-name product merges',()=>{
 const a=prepareImport(input([product,{...product,recordId:'synthetic-2',sku:'SyntheticOtherSKU',colorway:'Synthetic red'}]),source,emptyGraph());
 expect(a.summary.newRecords).toBe(2);expect(new Set(a.inserts.variants.map(v=>v.id)).size).toBe(2);expect(a.hash).toBe(prepareImport(input([product,{...product,recordId:'synthetic-2',sku:'SyntheticOtherSKU',colorway:'Synthetic red'}]),source,emptyGraph()).hash);
});
it('keeps Unicode display names and valid opaque public slugs without collapsing source identifiers',()=>{
 const plan=prepareImport(input([{...product,brand:'日本',recordId:'source  1'},{...product,brand:'日本',recordId:'source 1',sku:'SyntheticOtherSKU'}]),source,emptyGraph());expect(plan.inserts.brands[0].slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);expect(plan.rows.map(r=>r.recordId)).toEqual(['source  1','source 1']);expect(plan.inserts.entries).toHaveLength(2);
});
it('shares construction across colorways only with an explicit scoped construction key',()=>{
 const plan=prepareImport(input([product,{...product,recordId:'synthetic-2',sku:'SyntheticOtherSKU',colorway:'Synthetic red'}].map(p=>({...p,constructionKey:'explicit-synthetic-construction'}))),source,emptyGraph());expect(plan.inserts.variants).toHaveLength(1);expect(plan.inserts.entries).toHaveLength(2);
});
it('quarantines duplicate construction/colorway pairs even with different source references or SKUs',()=>{
 const plan=prepareImport(input([product,{...product,recordId:'second-ref',sku:'SYNTHETIC-SECOND'}].map(p=>({...p,constructionKey:'same-explicit-key'}))),source,emptyGraph());expect(plan.inserts.entries).toHaveLength(1);expect(plan.rows[1].outcome).toBe('POSSIBLE_MATCH');
});
it('does not share constructions across tiers, outsoles or generations',()=>{
 const products=[product,{...product,tier:'Pro'},{...product,outsole:'AG'},{...product,generation:'Synthetic gen 2'}].map((p,n)=>({...p,recordId:'synthetic-'+n,sku:'SyntheticSKU-'+n,constructionKey:'explicit-key'}));expect(prepareImport(input(products),source,emptyGraph()).inserts.variants).toHaveLength(4);
});
it('deduplicates identical source rows and quarantines divergent duplicate source IDs',()=>{
 const same=prepareImport(input([product,product]),source,emptyGraph());expect(same.summary.newRecords).toBe(1);expect(same.rows[1].action).toBe('NOOP');
 const conflict=prepareImport(input([product,{...product,tier:'Pro'}]),source,emptyGraph());expect(conflict.summary.conflicts).toBe(2);expect(conflict.inserts.entries).toHaveLength(0);
});
it('quarantines same-SKU contradictions within a file',()=>{
 const plan=prepareImport(input([product,{...product,recordId:'synthetic-2',outsole:'AG'}]),source,emptyGraph());expect(plan.summary.conflicts).toBe(2);expect(plan.inserts.entries).toHaveLength(0);
});
it('never gives incomplete/invalid rows executable status',()=>{
 const plan=prepareImport(input([{recordId:'missing'}, {...product,outsole:'lava'}]),source,emptyGraph());expect(plan.ready).toBe(false);expect(plan.rows[0].outcome).toBe('INSUFFICIENT_IDENTITY');expect(plan.rows[1].outcome).toBe('INVALID');
});
it('links an exact scoped SKU only with matching identity, stages rather than overwrites',()=>{
 const first=prepareImport(input([product]),source,emptyGraph());const graph={...emptyGraph(),...first.inserts};
 const exact=prepareImport(input([{...product,recordId:'another-source-reference'}]),source,graph);expect(exact.rows[0].outcome).toBe('EXACT_MATCH');expect(exact.rows[0].action).toBe('STAGE');expect(exact.inserts.entries).toHaveLength(0);
 const conflict=prepareImport(input([{...product,recordId:'another-source-reference',outsole:'AG'}]),source,graph);expect(conflict.rows[0].outcome).toBe('CONFLICT');
});
it('replays known source records without new hierarchies or observations',()=>{
 const first=prepareImport(input([product]),source,emptyGraph());const graph={...emptyGraph(),...first.inserts};const replay=prepareImport(input([product]),source,graph);expect(replay.rows[0].action).toBe('NOOP');expect(replay.inserts.entries).toHaveLength(0);
});
it('flags possible name/case matches without fuzzy merging',()=>{
 const first=prepareImport(input([product]),source,emptyGraph());const graph={...emptyGraph(),...first.inserts};
 for(const patch of [{sku:null},{sku:'syntheticsku'}]){const plan=prepareImport(input([{...product,...patch,recordId:'unlinked'}]),source,graph);expect(plan.rows[0].outcome).toBe('POSSIBLE_MATCH');expect(plan.inserts.entries).toHaveLength(0);}
});
it('stages conflicting source-backed claims without changing existing verified evidence',()=>{
 const first=prepareImport(input([product]),source,emptyGraph());const graph={...emptyGraph(),...first.inserts,claims:[{entryId:first.rows[0].entryId,variantId:null,attribute:'upperMaterial',value:'Verified synthetic original',status:'VERIFIED'}]};
 const changed={...product,specifications:[{attribute:'upperMaterial',value:'Contradicting synthetic report',basis:'REPORTED'}]};const plan=prepareImport(input([changed]),source,graph);expect(plan.rows[0].outcome).toBe('CONFLICT');expect(graph.claims[0].value).toBe('Verified synthetic original');
});
