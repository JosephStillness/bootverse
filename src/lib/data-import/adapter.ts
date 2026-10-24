import {boundedJson} from './parse';
import {ImportInputError} from './types';
// A trusted server adapter maps its provider's bounded GET response into canonical records.
// No default fetch or client-supplied endpoint exists. Live transports need their own reviewed SSRF policy.
export interface FeedAdapter{sourceId:string;page(context:{cursor:string|null;signal:AbortSignal;credentials:Readonly<Record<string,string>>}):Promise<{records:unknown[];nextCursor:string|null}>;}
export class FeedRetryError extends Error{constructor(public status:number,public retryAfterMs=0){super('Retryable feed response.');}}
type Settings={authorizationStatus:string;permissionDocumented:boolean;maxPages:number;maxRows:number;timeoutMs:number;minIntervalMs:number};
export async function collectFeed(adapter:FeedAdapter,settings:Settings,credentials:Readonly<Record<string,string>>,wait=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms))){
 if(!['GRANTED','NOT_REQUIRED'].includes(settings.authorizationStatus)||!settings.permissionDocumented)throw new ImportInputError('Document source access first.');
 if(settings.maxPages<1||settings.maxPages>100||settings.maxRows<1||settings.maxRows>5000||settings.timeoutMs<1||settings.timeoutMs>30000||settings.minIntervalMs<0||settings.minIntervalMs>30000)throw new ImportInputError('Invalid feed bounds.');
 const records:unknown[]=[];const seen=new Set<string>();let cursor:string|null=null,bytes=0;
 for(let page=0;page<settings.maxPages;page++){
  if(page)await wait(settings.minIntervalMs);
  let result:Awaited<ReturnType<FeedAdapter['page']>>|undefined;
  for(let attempt=0;attempt<3;attempt++){
   const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
   try{result=await Promise.race([adapter.page({cursor,signal:controller.signal,credentials}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new ImportInputError('Feed request failed or timed out.'));},settings.timeoutMs);})]);break;}
   catch(error){if(error instanceof FeedRetryError&&[429,500,502,503,504].includes(error.status)&&attempt<2){if(error.retryAfterMs>30000)throw new ImportInputError('Feed requires a longer pause; resume later.');await wait(Math.max(error.retryAfterMs,attempt?400:10));}else throw new ImportInputError('Feed request failed or timed out.');}
   finally{if(timer)clearTimeout(timer);}
  }
  if(!result||!Array.isArray(result.records)||records.length+result.records.length>settings.maxRows)throw new ImportInputError('Feed row limit exceeded.');
  const serialized=JSON.stringify(result.records);bytes+=Buffer.byteLength(serialized);if(bytes>10*1024*1024)throw new ImportInputError('Feed byte limit exceeded.');boundedJson(serialized);records.push(...result.records);
  if(result.nextCursor===null)return records;
  if(typeof result.nextCursor!=='string'||result.nextCursor.length>1000||seen.has(result.nextCursor))throw new ImportInputError('Invalid/repeated feed cursor.');seen.add(result.nextCursor);cursor=result.nextCursor;
 }
 throw new ImportInputError('Feed page limit exceeded; split the acquisition.');
}
