import {previewImport} from '@/lib/data-import/service';
import {importInput,importFailure} from '@/lib/data-import/http';
import {noStore} from '@/lib/platform/http';
export async function POST(request:Request){try{const x=await importInput(request,true);if(x.limited)return x.limited;return Response.json(await previewImport(x.actor,x.input),{headers:noStore});}catch(error){return importFailure(error);}}
