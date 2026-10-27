import {it,expect} from 'vitest';
import {signPreview,verifyPreview} from './ticket';
it('binds preview to actor, exact request and database plan with expiry',()=>{
 const secret='synthetic-ticket-test-secret-32-characters';const token=signPreview('actor','request','plan',secret,1000);
 expect(verifyPreview(token,'actor','request',secret,1001).planHash).toBe('plan');
 for(const [actor,request] of [['other','request'],['actor','changed']])expect(()=>verifyPreview(token,actor,request,secret,1001)).toThrow();
 expect(()=>verifyPreview(token+'tampered','actor','request',secret,1001)).toThrow();
 expect(()=>verifyPreview(token,'actor','request',secret,1000001)).toThrow();
});
