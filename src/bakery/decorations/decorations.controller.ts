import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { DecorationsService } from "./decorations.service";
import {
  CreateDecorationDto,
  UpdateDecorationDto,
} from "./dto/decorations.dto";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { TenantContext } from "../../common/tenant-context";
import { RequireFeature } from "../../common/decorators/require-feature.decorator";
import { FeatureFlagGuard } from "../../common/guards/feature-flag.guard";

@Controller("bakery/decorations")
@UseGuards(FeatureFlagGuard)
@RequireFeature("featureBakery")
export class DecorationsController {
  constructor(private readonly service: DecorationsService) {}

  @Get()
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query("activeOnly", new ParseBoolPipe({ optional: true }))
    activeOnly?: boolean,
  ) {
    this.assertTenant(tenant);
    return this.service.findAll(tenant.tenantId, activeOnly === true);
  }

  @Get(":id")
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    this.assertTenant(tenant);
    return this.service.findById(tenant.tenantId, id);
  }

  @Post()
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateDecorationDto,
  ) {
    this.assertTenant(tenant);
    return this.service.create(tenant.tenantId, dto);
  }

  @Put(":id")
  @Patch(":id")
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateDecorationDto,
  ) {
    this.assertTenant(tenant);
    return this.service.update(tenant.tenantId, id, dto);
  }

  @Delete(":id")
  async delete(
    @CurrentTenant() tenant: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    this.assertTenant(tenant);
    await this.service.delete(tenant.tenantId, id);
    return { success: true };
  }

  private assertTenant(
    tenant: TenantContext | undefined,
  ): asserts tenant is TenantContext {
    if (!tenant) {
      throw new ForbiddenException("Tenant context not available");
    }
  }
}
