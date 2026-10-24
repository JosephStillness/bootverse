import {executeEnrichment} from '@/lib/enrichment/service';
import {importInput,importFailure} from '@/lib/data-import/http';
import {noStore} from '@/lib/platform/http';
export const maxDuration=150;
export async function POST(request:Request){try{const x=await importInput(request);if(x.limited)return x.limited;return Response.json(await executeEnrichment(x.actor,x.input),{headers:noStore});}catch(error){return importFailure(error);}}
