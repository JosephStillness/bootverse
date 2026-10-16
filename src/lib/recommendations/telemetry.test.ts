import {it,expect,vi,afterEach} from 'vitest';
import {recommendationTelemetry} from './telemetry';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});
it('generates a correlation ID and logs only bounded diagnostics, never exception messages or inputs',()=>{
 const sink=vi.spyOn(console,'error').mockImplementation(()=>{});
 const run=recommendationTelemetry();
 const response=run.finish(Response.json({error:'Unavailable'},{status:503}),Object.assign(new Error('PRIVATE-MEASUREMENTS DATABASE_URL TOKEN'),{code:'P1001'}));
 expect(response.headers.get('x-request-id')).toMatch(/^[\da-f-]{36}$/);
 const log=JSON.parse(sink.mock.calls[0][0]);
 expect(log).toMatchObject({event:'boot_fit_request',entryPoint:'recommendation_api',category:'database',status:503,requestId:response.headers.get('x-request-id')});
 expect(log.durationMs).toBeGreaterThanOrEqual(0);
 expect(JSON.stringify(log)).not.toMatch(/PRIVATE|DATABASE_URL|TOKEN|P1001/);
});
it('keeps success timing opt-in and records only named stage durations',()=>{
 const sink=vi.spyOn(console,'info').mockImplementation(()=>{});
 recommendationTelemetry().finish(new Response());expect(sink).not.toHaveBeenCalled();
 vi.stubEnv('BOOT_FIT_TIMING_LOGS','1');const run=recommendationTelemetry();run.stage('access');run.finish(new Response());
 expect(JSON.parse(sink.mock.calls[0][0])).toMatchObject({category:'success',status:200,stages:{access:expect.any(Number)}});
});
it.each([[400,'validation'],[401,'authentication'],[403,'authorization'],[409,'conflict'],[413,'validation'],[429,'rate_limit'],[503,'unavailable']])('categorizes status %s without echoing errors', (status,category)=>{
 const sink=vi.spyOn(console,'warn').mockImplementation(()=>{});vi.spyOn(console,'error').mockImplementation(()=>{});
 const run=recommendationTelemetry();run.finish(new Response(null,{status}));
 const output=status>=500?vi.mocked(console.error).mock.calls:sink.mock.calls;
 expect(JSON.parse(output[0][0]).category).toBe(category);
});
