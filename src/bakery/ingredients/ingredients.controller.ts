import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { IngredientsService } from "./ingredients.service";
import {
  CreateIngredientDto,
  UpdateIngredientDto,
} from "./dto/ingredients.dto";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { TenantContext } from "../../common/tenant-context";
import { RequireFeature } from "../../common/decorators/require-feature.decorator";
import { FeatureFlagGuard } from "../../common/guards/feature-flag.guard";

@Controller("bakery/ingredients")
@UseGuards(FeatureFlagGuard)
@RequireFeature("featureBakery")
export class IngredientsController {
  constructor(private readonly service: IngredientsService) {}

  @Get()
  async findAll(@CurrentTenant() tenant: TenantContext) {
    this.assertTenant(tenant);
    return this.service.findAll(tenant.tenantId);
  }

  @Get("low-stock")
  async lowStock(@CurrentTenant() tenant: TenantContext) {
    this.assertTenant(tenant);
    return this.service.findLowStock(tenant.tenantId);
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
    @Body() dto: CreateIngredientDto,
  ) {
    this.assertTenant(tenant);
    return this.service.create(tenant.tenantId, dto);
  }

  @Put(":id")
  @Patch(":id")
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateIngredientDto,
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
