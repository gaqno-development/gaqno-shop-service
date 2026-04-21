import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from "@nestjs/common";
import { getCurrentTenant } from "../common/tenant-context";
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

  @Get()
  async list() {
    return this.tenantService.listActive();
  }

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

  @Post("switch")
  @HttpCode(HttpStatus.OK)
  async switch(@Body() body: { tenantId: string }) {
    const tenant = body?.tenantId
      ? await this.tenantService.getById(body.tenantId)
      : null;
    return { success: Boolean(tenant), tenant };
  }

  @Get("current/feature-flags")
  async currentFeatureFlags() {
    const tenantId = getCurrentTenant()?.tenantId;
    if (!tenantId) return null;
    return this.tenantService.getFeatureFlags(tenantId);
  }
}
