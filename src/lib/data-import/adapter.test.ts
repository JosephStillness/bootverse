import {it,expect} from 'vitest';
import {collectFeed,FeedFailure,FeedRetryError,type FeedAdapter} from './adapter';
const settings={authorizationStatus:'GRANTED',permissionDocumented:true,maxPages:3,maxRows:5,timeoutMs:30,minIntervalMs:0};
it('collects mapped mock pages with server-injected credentials and bounded pagination',async()=>{
 const adapter:FeedAdapter={sourceId:'synthetic-source',async page({cursor,credentials}){expect(credentials.key).toBe('synthetic-test-key');return {records:[{recordId:cursor??'first'}],nextCursor:cursor?null:'second'};}};
 expect(await collectFeed(adapter,settings,{key:'synthetic-test-key'})).toEqual([{recordId:'first'},{recordId:'second'}]);
});
it('requires documented access before calling even a mock adapter',async()=>{let called=false;await expect(collectFeed({sourceId:'s',async page(){called=true;return {records:[],nextCursor:null};}},{...settings,authorizationStatus:'UNKNOWN'},{})).rejects.toThrow();expect(called).toBe(false);});
it('retries only explicit safe feed failures and respects Retry-After',async()=>{
 let attempts=0;const waits:number[]=[];const adapter:FeedAdapter={sourceId:'s',async page(){if(attempts++===0)throw new FeedRetryError(429,10);return {records:[],nextCursor:null};}};
 await collectFeed(adapter,settings,{},async ms=>{waits.push(ms);});expect(attempts).toBe(2);expect(waits).toContain(10);
});
it('aborts timed out transport and hides provider error text',async()=>{
 const adapter:FeedAdapter={sourceId:'s',async page({signal}){await new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('synthetic-secret-provider-text'))));return {records:[],nextCursor:null};}};
 await expect(collectFeed(adapter,settings,{})).rejects.toThrow('Feed request failed or timed out.');
});
it('rejects repeated cursors and record/page overflow',async()=>{
 await expect(collectFeed({sourceId:'s',async page(){return {records:[],nextCursor:'repeated'};}},settings,{})).rejects.toThrow();
 await expect(collectFeed({sourceId:'s',async page(){return {records:Array(6).fill({}),nextCursor:null};}},settings,{})).rejects.toThrow();
});
it('categorizes failures for scheduling without exposing provider text',async()=>{
 const fail=(e:unknown)=>collectFeed({sourceId:'s',async page(){throw e;}},settings,{},async()=>{}).catch(x=>x);
 const limited=await fail(new FeedRetryError(429,120000));expect(limited).toBeInstanceOf(FeedFailure);expect(limited.category).toBe('RATE_LIMITED');expect(limited.retryAfterMs).toBe(120000);
 expect((await fail(new FeedRetryError(503))).category).toBe('UNAVAILABLE');
 expect((await fail(new FeedFailure('AUTHORIZATION'))).category).toBe('AUTHORIZATION');
 const unknown=await fail(Error('synthetic-secret-provider-text'));expect(unknown.category).toBe('UNAVAILABLE');expect(unknown.message).not.toContain('secret');
 const controller=new AbortController();controller.abort();
 expect((await collectFeed({sourceId:'s',async page(){return {records:[],nextCursor:null};}},settings,{},async()=>{},controller.signal).catch(x=>x)).category).toBe('CANCELLED');
});
