import { UnauthorizedException } from "@nestjs/common";

const TENANT_REQUIRED_MESSAGE = "Tenant context is required";

export function requireTenantId(tenantId: string | undefined): string {
  if (!tenantId) throw new UnauthorizedException(TENANT_REQUIRED_MESSAGE);
  return tenantId;
}
