import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { getCurrentTenant } from "../common/tenant-context";
import { TenantService } from "./tenant.service";
import { PlatformAdminGuard } from "../common/guards/platform-admin.guard";

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
  @UseGuards(PlatformAdminGuard)
  async list() {
    return this.tenantService.listActive();
  }

  @Get("summary")
  @UseGuards(PlatformAdminGuard)
  async summary() {
    return this.tenantService.listActiveWithSummary();
  }

  @Get("resolve")
  async resolve(@Headers("x-tenant-domain") domain: string) {
    const tenant = await this.tenantService.resolve(domain);
    const flags = tenant
      ? await this.tenantService.getFeatureFlags(tenant.id)
      : null;
    const vertical = tenant
      ? await this.tenantService.getVerticalPreset(tenant.id)
      : null;

    return {
      tenant,
      featureFlags: flags,
      vertical,
    };
  }

  @Post("switch")
  @HttpCode(HttpStatus.OK)
  @UseGuards(PlatformAdminGuard)
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
