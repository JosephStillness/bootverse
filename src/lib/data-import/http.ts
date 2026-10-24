import 'server-only';
import {currentUser} from '@/lib/accounts/service';
import {sameOriginRequest} from '@/lib/accounts/config';
import {AccessError} from '@/lib/accounts/authorization';
import {limitedText} from '@/lib/accounts/request';
import {readOnlyAuth} from '@/lib/accounts/read-only-auth';
import {platformActor,platformFailure,noStore} from '@/lib/platform/http';
import {importAdmin,localImportsOnly} from './service';
import {ImportInputError,importLimits} from './types';
import {boundedJson} from './parse';
const previews=new Map<string,{count:number;until:number}>();
export async function importInput(request:Request,dryRun=false){
 localImportsOnly();if(!sameOriginRequest(request))throw new AccessError(403,'Invalid request origin.');
 let actor;
 if(dryRun){actor=importAdmin(await readOnlyAuth.run(true,()=>currentUser()));const now=Date.now();for(const [key,value] of previews)if(value.until<now)previews.delete(key);const value=previews.get(actor.id)??{count:0,until:now+15*60*1000};if(value.count>=30||previews.size>=1000&&!previews.has(actor.id))return {limited:Response.json({error:'Too many previews. Please wait.'},{status:429,headers:noStore})};value.count++;previews.set(actor.id,value);
 }else{const auth=await platformActor(request,'product-import',30);if(auth.limited)return auth;actor=importAdmin(auth.actor);}
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new ImportInputError('Send a JSON import envelope.');
 const content=await limitedText(request,importLimits().maxBytes*2+16384);return {actor,input:boundedJson(content),limited:undefined};
}
export function importFailure(error:unknown){return error instanceof ImportInputError?Response.json({error:error.message},{status:400,headers:noStore}):platformFailure(error);}
