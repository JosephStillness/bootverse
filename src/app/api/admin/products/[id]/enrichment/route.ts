import {enrichmentQuality} from '@/lib/enrichment/service';
import {currentUser} from '@/lib/accounts/service';
import {platformFailure,noStore} from '@/lib/platform/http';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{return Response.json(await enrichmentQuality(await currentUser(),(await params).id),{headers:noStore});}catch(error){return platformFailure(error);}}
