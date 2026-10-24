import {z} from 'zod';
import {currentUser} from '@/lib/accounts/service';
import {importReport,pruneImport,localImportsOnly} from '@/lib/data-import/service';
import {importFailure} from '@/lib/data-import/http';
import {platformInput,noStore} from '@/lib/platform/http';
import {reportCsv} from '@/lib/data-import/parse';
import type {DiagnosticRow} from '@/lib/data-import/types';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{localImportsOnly();const q=z.object({page:z.coerce.number().int().min(1).max(1000).default(1),download:z.literal('csv').optional()}).strict().parse(Object.fromEntries(new URL(request.url).searchParams));const report=await importReport(await currentUser(),(await params).id,q.page,!!q.download);if(q.download){const rows:DiagnosticRow[]=report.rows.map(r=>({row:r.rowNumber,recordId:r.recordId,outcome:r.outcome as DiagnosticRow['outcome'],diagnostics:Array.isArray(r.diagnostics)?r.diagnostics.filter((v):v is string=>typeof v==='string'):[]}));return new Response(reportCsv(rows),{headers:{...noStore,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="import-${report.id}.csv"`}});}return Response.json(report,{headers:noStore});}catch(error){return importFailure(error);}}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){try{localImportsOnly();const x=await platformInput(request,'product-import-prune',20);if(x.limited)return x.limited;z.object({confirmed:z.literal(true)}).strict().parse(x.input);return Response.json(await pruneImport(x.actor,(await params).id),{headers:noStore});}catch(error){return importFailure(error);}}
