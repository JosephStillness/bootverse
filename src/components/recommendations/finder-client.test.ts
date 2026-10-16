import {afterEach,it,expect,vi} from 'vitest';
import {runFinder} from './finder-client';
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
