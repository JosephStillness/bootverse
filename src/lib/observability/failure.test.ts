import {it,expect,vi,afterEach} from 'vitest';
import {serviceFailure} from './failure';
afterEach(()=>vi.restoreAllMocks());
it.each(['P2021','P2010'])('correlates unavailable DB response %s without logging secrets, inputs or exception text',code=>{
 const sink=vi.spyOn(console,'error').mockImplementation(()=>{});
 const r=serviceFailure(new Response(null,{status:503}),Object.assign(new Error('PRIVATE FOOT DATA token database password'),{code}));
 const log=JSON.parse(sink.mock.calls[0][0]);expect(log).toMatchObject({event:'service_failure',category:'database',status:503,requestId:r.headers.get('x-request-id')});expect(log.requestId).toMatch(/^[a-f0-9-]{36}$/);expect(JSON.stringify(log)).not.toMatch(/PRIVATE|password|token|P2021/);
});
