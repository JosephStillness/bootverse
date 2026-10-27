import {boundedJson} from './parse';
import {ImportInputError} from './types';
// A trusted server adapter maps its provider's bounded GET response into canonical records.
// No default fetch or client-supplied endpoint exists. Live transports need their own reviewed SSRF policy.
export interface FeedAdapter{sourceId:string;page(context:{cursor:string|null;signal:AbortSignal;credentials:Readonly<Record<string,string>>}):Promise<{records:unknown[];nextCursor:string|null}>;}
export class FeedRetryError extends Error{constructor(public status:number,public retryAfterMs=0){super('Retryable feed response.');}}
// D5: categorized failure for scheduling/backoff. Messages stay generic; provider text is never surfaced.
export type FeedFailureCategory='TIMEOUT'|'UNAVAILABLE'|'RATE_LIMITED'|'AUTHORIZATION'|'CONFIG'|'INVALID_FEED'|'CANCELLED';
export class FeedFailure extends ImportInputError{constructor(public category:FeedFailureCategory,public retryAfterMs=0,message='Feed request failed or timed out.'){super(message);}}
type Settings={authorizationStatus:string;permissionDocumented:boolean;maxPages:number;maxRows:number;timeoutMs:number;minIntervalMs:number};
export async function collectFeed(adapter:FeedAdapter,settings:Settings,credentials:Readonly<Record<string,string>>,wait=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms)),outer?:AbortSignal){
 if(!['GRANTED','NOT_REQUIRED'].includes(settings.authorizationStatus)||!settings.permissionDocumented)throw new ImportInputError('Document source access first.');
 if(settings.maxPages<1||settings.maxPages>100||settings.maxRows<1||settings.maxRows>5000||settings.timeoutMs<1||settings.timeoutMs>30000||settings.minIntervalMs<0||settings.minIntervalMs>30000)throw new ImportInputError('Invalid feed bounds.');
 const records:unknown[]=[];const seen=new Set<string>();let cursor:string|null=null,bytes=0;
 for(let page=0;page<settings.maxPages;page++){
  if(page)await wait(settings.minIntervalMs);
  let result:Awaited<ReturnType<FeedAdapter['page']>>|undefined;
  for(let attempt=0;attempt<3;attempt++){
   const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
   try{if(outer?.aborted)throw new FeedFailure('CANCELLED',0,'Feed acquisition was cancelled.');result=await Promise.race([adapter.page({cursor,signal:controller.signal,credentials}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new FeedFailure('TIMEOUT'));},settings.timeoutMs);})]);break;}
   catch(error){
    if(error instanceof FeedRetryError&&[429,500,502,503,504].includes(error.status)){
     if(error.retryAfterMs>30000)throw new FeedFailure('RATE_LIMITED',error.retryAfterMs,'Feed requires a longer pause; resume later.');
     if(attempt<2){await wait(Math.max(error.retryAfterMs,attempt?400:10));continue;}
     throw new FeedFailure(error.status===429?'RATE_LIMITED':'UNAVAILABLE',error.retryAfterMs);
    }
    if(error instanceof FeedFailure)throw error;
    throw new FeedFailure('UNAVAILABLE');
   }
   finally{if(timer)clearTimeout(timer);}
  }
  if(!result||!Array.isArray(result.records))throw new FeedFailure('INVALID_FEED',0,'Feed response is malformed.');
  if(records.length+result.records.length>settings.maxRows)throw new ImportInputError('Feed row limit exceeded.');
  const serialized=JSON.stringify(result.records);bytes+=Buffer.byteLength(serialized);if(bytes>10*1024*1024)throw new ImportInputError('Feed byte limit exceeded.');boundedJson(serialized);records.push(...result.records);
  if(result.nextCursor===null)return records;
  if(typeof result.nextCursor!=='string'||result.nextCursor.length>1000||seen.has(result.nextCursor))throw new ImportInputError('Invalid/repeated feed cursor.');seen.add(result.nextCursor);cursor=result.nextCursor;
 }
 throw new ImportInputError('Feed page limit exceeded; split the acquisition.');
}
