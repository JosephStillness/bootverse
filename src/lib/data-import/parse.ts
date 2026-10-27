import {parse} from 'csv-parse/sync';
import {z} from 'zod';
import {columns,mappingSchema} from './schemas';
import {ImportInputError,defaultLimits,type DiagnosticRow,type ImportFormat} from './types';
const required=['recordId','brand','family','generation','tier','colorway','sourceUrl','observedAt'];
export function boundedJson(content:string):unknown{
 let depth=0,quoted=false,escaped=false;
 for(const char of content){if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;}else if(char==='"')quoted=true;else if(char==='{'||char==='['){if(++depth>12)throw new ImportInputError('JSON nesting exceeds 12 levels.');}else if(char==='}'||char===']')depth--;}
 try{return JSON.parse(content,(key,value)=>{if(/^(?:__proto__|prototype|constructor|password|credentials|authorization|secret|api_?key|access_?token)$/i.test(key))throw new ImportInputError('Forbidden JSON field.');if(typeof value==='string'&&(value.includes('\0')||value.includes('\uFFFD')||Buffer.from(value,'utf8').toString('utf8')!==value))throw new ImportInputError('Invalid Unicode.');return value;});}catch{throw new ImportInputError('Invalid or unsafe JSON.');}
}
export function parseInput(content:string,format:ImportFormat,mapping:Record<string,string>={},limits=defaultLimits){
 if(!content.trim())throw new ImportInputError('Import file is empty.');
 if(Buffer.byteLength(content,'utf8')>limits.maxBytes)throw new ImportInputError('Import exceeds the byte limit.');
 if(content.includes('\0')||content.includes('\uFFFD')||Buffer.from(content,'utf8').toString('utf8')!==content)throw new ImportInputError('Use valid UTF-8.');
 content=content.replace(/^\uFEFF/,'');
 if(format==='JSON'){
  if(Object.keys(mapping).length)throw new ImportInputError('Column mapping is CSV-only.');
  const body=z.object({version:z.literal(1),products:z.array(z.unknown()).min(1).max(limits.maxRows)}).strict().safeParse(boundedJson(content));
  if(!body.success)throw new ImportInputError('Expected version 1 and a bounded, nonempty products array.');
  return {rows:body.data.products.map((value,i)=>({row:i+1,value,errors:[] as string[]})),warnings:[] as string[]};
 }
 const columnMapping=mappingSchema.parse(mapping);let parsed:{record:string[];info:{lines:number}}[];
 try{const rows:unknown=parse(content,{bom:true,skip_empty_lines:true,relax_column_count:true,info:true,max_record_size:65536,to:limits.maxRows+2});parsed=z.array(z.object({record:z.array(z.string()),info:z.object({lines:z.number()})})).parse(rows);}catch{throw new ImportInputError('Malformed CSV quoting or record too large.');}
 const headers=parsed.shift()?.record.map(h=>h.trim().normalize('NFC'))??[];
 if(!headers.length||headers.length>40||headers.some(h=>!h)||new Set(headers).size!==headers.length)throw new ImportInputError('Use distinct, nonempty CSV headers (maximum 40).');
 if(!parsed.length||parsed.length>limits.maxRows)throw new ImportInputError('CSV is empty or exceeds the row limit.');
 const map=Object.fromEntries(columns.map(key=>[key,columnMapping[key]??key]));
 const warnings=required.filter(key=>!headers.includes(map[key])).map(key=>'missing_column:'+key);
 return {warnings,rows:parsed.map(({record,info})=>{
  const value:Record<string,unknown>={};const errors:string[]=record.length===headers.length?[]:['column_count'];
  for(const key of columns){const at=headers.indexOf(map[key]);const field=at>=0?record[at]:undefined;if(field===undefined||!field.trim())continue;
   try{value[key]=['colorNames','specifications','images','offers'].includes(key)?boundedJson(field):field;}catch{errors.push('invalid_json_cell:'+key);}
  }
  return {row:info.lines,value,errors};
 })};
}
function cell(value:unknown){let text=String(value??'');if(/^[\s\uFEFF]*[=+@-]|^[\t\r\n]/u.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
export function reportCsv(rows:DiagnosticRow[]){return [['row','recordId','outcome','diagnostics'],...rows.map(r=>[r.row,r.recordId,r.outcome,r.diagnostics.join('; ')])].map(r=>r.map(cell).join(',')).join('\r\n');}
