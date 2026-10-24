import {describe,it,expect} from 'vitest';
import {parseInput,reportCsv} from './parse';
import {normalizeRecord} from './normalize';
const record={recordId:'synthetic-1',brand:'Synthetic brand',family:'Synthetic family',generation:'Synthetic generation',tier:'Elite',outsole:'FG',colorway:'Synthetic blue',sourceUrl:'https://example.test/product',observedAt:'2026-10-01T00:00:00Z'};
const json=(products:unknown[])=>JSON.stringify({version:1,products});
describe('D2 bounded parsing',()=>{
 it('accepts canonical JSON and optional unknown specifications',()=>{expect(parseInput(json([record]),'JSON').rows[0].value).toEqual(record);});
 it('handles BOM, quoted commas, escaped quotes and multiline UTF-8 CSV fields',()=>{
  const csv='\uFEFFrecordId,brand,family,generation,tier,outsole,colorway,sourceUrl,observedAt\r\nx,"Giày, synthetic","Family ""QA""",Gen,Elite,FG,"Blue\nWhite",https://example.test/x,2026-10-01T00:00:00Z';
  const rows=parseInput(csv,'CSV').rows;expect(rows).toHaveLength(1);expect(rows[0].value).toMatchObject({brand:'Giày, synthetic',family:'Family "QA"',colorway:'Blue\nWhite'});
 });
 it('uses explicit column mapping and reports missing required columns',()=>{
  const csv='Ref,Maker\nx,Synthetic';const result=parseInput(csv,'CSV',{recordId:'Ref',brand:'Maker'});expect(result.rows[0].value).toMatchObject({recordId:'x',brand:'Synthetic'});expect(result.warnings).toContain('missing_column:family');
 });
 it('reports uneven CSV rows without shifting later identities',()=>{
  const result=parseInput('recordId,brand\nx\ny,Brand','CSV');expect(result.rows[0].errors).toContain('column_count');expect(result.rows[1].value).toMatchObject({recordId:'y',brand:'Brand'});
 });
 it.each(['','{broken','{"version":1,"products":{}}','{"version":1,"products":[],"extra":true}'] )('rejects empty/malformed structural JSON %s',content=>expect(()=>parseInput(content,'JSON')).toThrow());
 it('rejects depth, prototype keys, corrupt Unicode, excess rows and bytes',()=>{
  for(const content of ['['.repeat(20)+'0'+']'.repeat(20),'{"__proto__":{}}',json([{...record,brand:'\uD800'}])])expect(()=>parseInput(content,'JSON')).toThrow();
  expect(()=>parseInput(json([record,record]),'JSON',{}, {maxBytes:10000,maxRows:1})).toThrow();
  expect(()=>parseInput(json([record]),'JSON',{}, {maxBytes:30,maxRows:10})).toThrow();
 });
 it('rejects duplicate headers and malformed CSV quoting',()=>{
  expect(()=>parseInput('recordId,recordId\nx,y','CSV')).toThrow();expect(()=>parseInput('recordId,brand\nx,"unfinished','CSV')).toThrow();
 });
 it('neutralizes spreadsheet formulas in exported reports',()=>{
  expect(reportCsv([{row:1,recordId:' =HYPERLINK("x")',outcome:'CONFLICT',diagnostics:['unsafe']}])).toContain("' =HYPERLINK");
 });
});
describe('D2 deterministic normalization',()=>{
 it('normalizes aliases/Unicode and preserves specific terminology',()=>{
  const r=normalizeRecord({...record,brand:' NIKE ',tier:' ELITE ',outsole:'AG-Pro',colorway:' Gia\u0300y '},'source');expect(r.brand).toBe('Nike');expect(r.tier).toBe('Elite');expect(r.outsole).toBe('AG');expect(r.manufacturerOutsole).toBe('AG-Pro');expect(r.colorway).toBe('Giày');expect(r.swatch).toBeNull();
 });
 it('represents unknown outsole, size and specifications without invented values',()=>{
  const r=normalizeRecord({...record,outsole:null},'source');expect(r.outsole).toBeNull();expect(r.specifications).toEqual([]);expect(r.sku).toBeNull();expect(r.constructionKey).toBeNull();
 });
 it('validates contextual units without inferring fit or safety',()=>{
  const r=normalizeRecord({...record,specifications:[{attribute:'weight',basis:'MEASURED',value:{amount:0.2,unit:'kg',size:'9',sizeSystem:'UK',method:'Synthetic fixture'}}]},'source');expect(r.specifications[0].value).toMatchObject({amount:200,unit:'g'});
 });
 it.each([{outsole:'muddy'}, {tier:''}, {specifications:[{attribute:'weight',value:200,basis:'REPORTED'}]}, {published:true}, {sourceUrl:'https://example.test?token=secret'}, {images:[{externalUrl:'javascript:alert(1)'}]}, {apiKey:'private'}])('rejects malformed canonical data %j',patch=>expect(()=>normalizeRecord({...record,...patch},'source')).toThrow());
 it('preserves case-sensitive SKUs and region scope',()=>{const r=normalizeRecord({...record,sku:' Synthetic-AbC ',skuRegion:'AU'},'source');expect(r.sku).toBe('Synthetic-AbC');expect(r.skuRegion).toBe('AU');});
});
it('preserves explicitly unknown technical values for D3 feed enrichment',()=>{
 const normalized=normalizeRecord({...record,specifications:[{attribute:'weight',value:null,basis:'REPORTED'},{attribute:'upperMaterial',value:null,basis:'REPORTED'}]},'source');
 expect(normalized.specifications.map(c=>c.value)).toEqual([{unknown:true},{unknown:true}]);
});
