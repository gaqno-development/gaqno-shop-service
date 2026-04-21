import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { RecipesService } from "./recipes.service";
import {
  CreateRecipeDto,
  ReplaceRecipeIngredientsDto,
  UpdateRecipeDto,
} from "./dto/recipes.dto";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { TenantContext } from "../../common/tenant-context";
import { RequireFeature } from "../../common/decorators/require-feature.decorator";
import { FeatureFlagGuard } from "../../common/guards/feature-flag.guard";

@Controller("bakery/recipes")
@UseGuards(FeatureFlagGuard)
@RequireFeature("featureBakery")
export class RecipesController {
  constructor(private readonly service: RecipesService) {}

  @Get()
  async findAll(@CurrentTenant() tenant: TenantContext) {
    this.assertTenant(tenant);
    return this.service.findAll(tenant.tenantId);
  }

  @Get(":id")
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    this.assertTenant(tenant);
    return this.service.findById(tenant.tenantId, id);
  }

  @Get(":id/ingredients")
  async getIngredients(
    @CurrentTenant() tenant: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    this.assertTenant(tenant);
    return this.service.getIngredients(tenant.tenantId, id);
  }

  @Get(":id/cost")
  async getCost(
    @CurrentTenant() tenant: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    this.assertTenant(tenant);
    return this.service.getCost(tenant.tenantId, id);
  }

  @Put(":id/ingredients")
  async replaceIngredients(
    @CurrentTenant() tenant: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReplaceRecipeIngredientsDto,
  ) {
    this.assertTenant(tenant);
    await this.service.replaceIngredients(tenant.tenantId, id, dto);
    return { success: true };
  }

  @Post()
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateRecipeDto,
  ) {
    this.assertTenant(tenant);
    return this.service.create(tenant.tenantId, dto);
  }

  @Put(":id")
  @Patch(":id")
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecipeDto,
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
