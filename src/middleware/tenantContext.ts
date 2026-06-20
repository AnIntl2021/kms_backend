import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  dbName: string;
}

export const tenantContext = new AsyncLocalStorage<TenantContext>();
