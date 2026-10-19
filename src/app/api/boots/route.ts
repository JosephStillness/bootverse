import {catalogueQuery,listCatalogue} from '@/lib/boots/service';
import {communityFailure} from '@/lib/community/http';
export async function GET(request:Request){
 try{return Response.json(await listCatalogue(catalogueQuery(new URL(request.url).searchParams)),{headers:{'Cache-Control':'no-store'}});}
 catch(error){return communityFailure(error);}
}
