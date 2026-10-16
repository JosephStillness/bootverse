import type {PrivateFootProfile} from '@/lib/foot-profile/service';
import type {EngineOutput} from '@/lib/recommendations/types';
import {saveFinderPayload,type FinderValues} from '@/lib/recommendations/finder';
async function responseData<T>(response:Response):Promise<T> {
 let data:unknown;
 try{data=await response.json();}catch{throw Error('The service returned an unreadable response. Please try again.');}
 if(!response.ok){const message=data&&typeof data==='object'&&'error' in data&&typeof data.error==='string'?data.error:'The request could not be completed.';throw Error(message);}
 // Responses are produced by our typed server services; untrusted inputs are validated there.
 return data as T;
}
export async function loadFinderProfile(signal:AbortSignal) {
 return responseData<{profile:PrivateFootProfile|null}>(await fetch('/api/account/foot-profile',{cache:'no-store',signal}));
}
export async function runFinder(values:FinderValues) {
 try {
  return await responseData<EngineOutput>(await fetch('/api/boot-fit/recommendations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({preferences:values,processingConsent:true,limit:20}),signal:AbortSignal.timeout(20_000)}));
 } catch(error) {
  if(error instanceof DOMException&&error.name==='TimeoutError')throw Error('The recommendation request timed out. Please try again.');
  throw error;
 }
}
export async function saveFinderProfile(values:FinderValues,profile:PrivateFootProfile|null) {
 return responseData<{profile:PrivateFootProfile}>(await fetch('/api/account/foot-profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(saveFinderPayload(values,profile))}));
}
