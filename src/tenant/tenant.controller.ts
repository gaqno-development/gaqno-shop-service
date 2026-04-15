import { Controller, Get, Headers } from "@nestjs/common";
import { TenantService } from "./tenant.service";

@Controller()
export class HealthController {
  @Get("health")
  health() {
    return { status: "ok" };
  }
}

@Controller("tenants")
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get("resolve")
  async resolve(@Headers("x-tenant-domain") domain: string) {
    const tenant = await this.tenantService.resolve(domain);
    const flags = tenant 
      ? await this.tenantService.getFeatureFlags(tenant.id)
      : null;
    
    return {
      tenant,
      featureFlags: flags,
    };
  }
}
