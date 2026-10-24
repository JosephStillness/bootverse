import {currentUser} from '@/lib/accounts/service';
import {executeImport,importHistory,localImportsOnly} from '@/lib/data-import/service';
import {importInput,importFailure} from '@/lib/data-import/http';
import {noStore} from '@/lib/platform/http';
export const maxDuration=150;
export async function GET(request:Request){try{localImportsOnly();return Response.json(await importHistory(await currentUser(),Object.fromEntries(new URL(request.url).searchParams)),{headers:noStore});}catch(error){return importFailure(error);}}
export async function POST(request:Request){try{const x=await importInput(request);if(x.limited)return x.limited;return Response.json(await executeImport(x.actor,x.input),{headers:noStore});}catch(error){return importFailure(error);}}
