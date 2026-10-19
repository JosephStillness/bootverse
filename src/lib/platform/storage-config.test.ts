import {it,expect,vi,afterEach} from 'vitest';
vi.mock('server-only',()=>({}));
import {storage} from './storage';
afterEach(()=>vi.unstubAllEnvs());
it('supports AWS default credentials without embedded static keys',()=>{
 vi.stubEnv('S3_BUCKET','test-only');vi.stubEnv('S3_ENDPOINT','');vi.stubEnv('S3_ACCESS_KEY_ID','');vi.stubEnv('S3_SECRET_ACCESS_KEY','');vi.stubEnv('S3_SESSION_TOKEN','');
 expect(()=>storage()).not.toThrow();
});
it('rejects partial static credentials and unsafe object endpoints',()=>{
 vi.stubEnv('S3_BUCKET','test-only');vi.stubEnv('S3_ACCESS_KEY_ID','test-only');vi.stubEnv('S3_SECRET_ACCESS_KEY','');expect(()=>storage()).toThrow();
 vi.stubEnv('S3_SECRET_ACCESS_KEY','test-only');vi.stubEnv('S3_ENDPOINT','http://external.example.test');expect(()=>storage()).toThrow('Unsafe storage');
});
