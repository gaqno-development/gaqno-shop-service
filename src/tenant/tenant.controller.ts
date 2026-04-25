import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { getCurrentTenant } from "../common/tenant-context";
import { TenantService } from "./tenant.service";
import { TenantDnsService } from "./tenant-dns.service";
import { PlatformAdminGuard } from "../common/guards/platform-admin.guard";
import { UpdateTenantFeatureFlagsDto } from "./dto/update-tenant-feature-flags.dto";
import { UpdateTenantProfileDto } from "./dto/update-tenant-profile.dto";
import { SyncFromSsoDto } from "./dto/sync-from-sso.dto";
import { CheckTenantDnsDto } from "./dto/check-tenant-dns.dto";
import { GenerateStorefrontCopySuggestionDto } from "./dto/generate-storefront-copy-suggestion.dto";

@Controller()
export class HealthController {
  @Get("health")
  health() {
    return { status: "ok" };
  }
}

@Controller("tenants")
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly tenantDnsService: TenantDnsService,
  ) {}

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
      ? await this.tenantService.ensureTenantExists(body.tenantId)
      : null;
    return { success: Boolean(tenant), tenant };
  }

  @Post("sync-from-sso")
  @HttpCode(HttpStatus.OK)
  @UseGuards(PlatformAdminGuard)
  async syncFromSso(@Body() body: SyncFromSsoDto) {
    const tenant = await this.tenantService.syncFromSso(body.ssoTenantId);
    return { tenant };
  }

  @Get("current/feature-flags")
  async currentFeatureFlags() {
    const tenantId = getCurrentTenant()?.tenantId;
    if (!tenantId) return null;
    return this.tenantService.getFeatureFlags(tenantId);
  }

  @Get(":tenantId/feature-flags")
  @UseGuards(PlatformAdminGuard)
  async tenantFeatureFlags(@Param("tenantId") tenantId: string) {
    return this.tenantService.getFeatureFlags(tenantId);
  }

  @Get(":tenantId")
  @UseGuards(PlatformAdminGuard)
  async platformTenantDetail(@Param("tenantId") tenantId: string) {
    const tenant = await this.tenantService.ensureTenantExists(tenantId);
    const featureFlags = await this.tenantService.getFeatureFlags(tenantId);
    return { tenant, featureFlags };
  }

  @Patch(":tenantId/feature-flags")
  @UseGuards(PlatformAdminGuard)
  async updateTenantFeatureFlags(
    @Param("tenantId") tenantId: string,
    @Body() dto: UpdateTenantFeatureFlagsDto,
  ) {
    return this.tenantService.updateFeatureFlags(tenantId, dto);
  }

  @Patch(":tenantId")
  @UseGuards(PlatformAdminGuard)
  async updateTenantProfile(
    @Param("tenantId") tenantId: string,
    @Body() dto: UpdateTenantProfileDto,
  ) {
    return this.tenantService.updateProfile(tenantId, dto);
  }

  @Post(":tenantId/storefront-copy/suggest")
  @UseGuards(PlatformAdminGuard)
  async generateStorefrontCopySuggestion(
    @Param("tenantId") tenantId: string,
    @Body() dto: GenerateStorefrontCopySuggestionDto,
  ) {
    return this.tenantService.generateStorefrontCopySuggestion(tenantId, dto);
  }

  @Post(":tenantId/check-dns")
  @HttpCode(HttpStatus.OK)
  @UseGuards(PlatformAdminGuard)
  async checkTenantDns(
    @Param("tenantId") tenantId: string,
    @Body() body: CheckTenantDnsDto,
  ) {
    const tenant = await this.tenantService.ensureTenantExists(tenantId);
    const fromBody = body.hostname?.trim() ?? "";
    const fromTenant = tenant.domain?.trim() ?? "";
    const raw = fromBody.length > 0 ? fromBody : fromTenant;
    return this.tenantDnsService.checkPublicDns(raw);
  }
}
