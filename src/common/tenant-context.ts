import { AsyncLocalStorage } from "async_hooks";

export interface TenantContext {
  tenantId: string;
  slug: string;
  domain: string | null;
  name: string;
  isDropshipping: boolean;
  orderPrefix: string;
}

export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

export function getCurrentTenant(): TenantContext | undefined {
  return tenantContextStorage.getStore();
}
