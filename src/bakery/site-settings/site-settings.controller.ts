import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Put,
  UseGuards,
} from "@nestjs/common";
import { SiteSettingsService } from "./site-settings.service";
import { UpsertSiteSettingsDto } from "./dto/site-settings.dto";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { TenantContext } from "../../common/tenant-context";
import { RequireFeature } from "../../common/decorators/require-feature.decorator";
import { FeatureFlagGuard } from "../../common/guards/feature-flag.guard";

@Controller("bakery/site-settings")
export class SiteSettingsController {
  constructor(private readonly service: SiteSettingsService) {}

  @Get()
  async get(@CurrentTenant() tenant: TenantContext) {
    this.assertTenant(tenant);
    return this.service.getOrCreate(tenant.tenantId);
  }

  @Put()
  @UseGuards(FeatureFlagGuard)
  @RequireFeature("featureBakery")
  async upsert(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpsertSiteSettingsDto,
  ) {
    this.assertTenant(tenant);
    return this.service.upsert(tenant.tenantId, dto);
  }

  private assertTenant(
    tenant: TenantContext | undefined,
  ): asserts tenant is TenantContext {
    if (!tenant) {
      throw new ForbiddenException("Tenant context not available");
    }
  }
}
