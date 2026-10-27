import {updateAssetPresentation} from '@/lib/enrichment/service';
import {platformInput,platformFailure,noStore} from '@/lib/platform/http';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){try{const x=await platformInput(request,'product-data',60);if(x.limited)return x.limited;return Response.json(await updateAssetPresentation(x.actor,(await params).id,x.input),{headers:noStore});}catch(e){return platformFailure(e);}}
