import 'server-only';
import {AsyncLocalStorage} from 'node:async_hooks';
// Dry-run authentication must not refresh/delete database sessions as a side effect.
export const readOnlyAuth=new AsyncLocalStorage<boolean>();
