import {afterEach,it,expect,vi} from 'vitest';
import {runFinder,loadFinderProfile} from './finder-client';
import {emptyFinder} from '@/lib/recommendations/finder';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
it('bounds a stalled recommendation request and gives a useful retry message',async()=>{
 const controller=new AbortController();vi.spyOn(AbortSignal,'timeout').mockReturnValue(controller.signal);
 vi.stubGlobal('fetch',vi.fn((_url,init?:RequestInit)=>new Promise((_resolve,reject)=>{
  init?.signal?.addEventListener('abort',()=>reject(init.signal?.reason),{once:true});
 })));
 const request=runFinder({...emptyFinder(),surface:'AG'});
 const assertion=expect(request).rejects.toThrow('The recommendation request timed out. Please try again.');
 controller.abort(new DOMException('Timed out','TimeoutError'));
 // Without a timeout signal this remains pending, leaving the form permanently busy.
 await assertion;
});
it('preserves server validation errors instead of disguising them as timeouts',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({error:'Consent required'},{status:403})));
 await expect(runFinder({...emptyFinder(),surface:'AG'})).rejects.toThrow('Consent required');
});

it('bounds saved-profile loading and reports a recoverable timeout', async () => {
 const timeout=new AbortController();vi.spyOn(AbortSignal,'timeout').mockReturnValue(timeout.signal);
 vi.stubGlobal('fetch',vi.fn((_url,init?:RequestInit)=>new Promise((_resolve,reject)=>{
  init?.signal?.addEventListener('abort',()=>reject(init.signal?.reason),{once:true});
 })));
 const pending=loadFinderProfile(new AbortController().signal);
 const assertion=expect(pending).rejects.toThrow('Your saved profile took too long to load. Retry or continue manually without saving.');
 timeout.abort(new DOMException('Timed out','TimeoutError'));
 await assertion;
});
it('loads only the authenticated profile response',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({profile:null})));
 await expect(loadFinderProfile(new AbortController().signal)).resolves.toEqual({profile:null});
});
it.each([401,503])('preserves profile API failure %s and allows a later retry',async status=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({error:'Profile unavailable'},{status})).mockResolvedValueOnce(Response.json({profile:null})));
 await expect(loadFinderProfile(new AbortController().signal)).rejects.toThrow('Profile unavailable');
 await expect(loadFinderProfile(new AbortController().signal)).resolves.toEqual({profile:null});
});
it('propagates navigation/manual cancellation without treating it as timeout',async()=>{
 const owner=new AbortController();
 vi.stubGlobal('fetch',vi.fn((_url,init?:RequestInit)=>new Promise((_resolve,reject)=>{
  init?.signal?.addEventListener('abort',()=>reject(init.signal?.reason),{once:true});
 })));
 const pending=loadFinderProfile(owner.signal),assertion=expect(pending).rejects.toMatchObject({name:'AbortError'});
 owner.abort();await assertion;
});
it('propagates a network failure without inventing an empty profile',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('offline')));
 await expect(loadFinderProfile(new AbortController().signal)).rejects.toThrow('offline');
});
it('accepts a slow successful profile response before the deadline',async()=>{
 let finish!:(value:Response)=>void;
 vi.stubGlobal('fetch',vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve;})));
 const result=loadFinderProfile(new AbortController().signal);
 await Promise.resolve();finish(Response.json({profile:null}));
 await expect(result).resolves.toEqual({profile:null});
});
