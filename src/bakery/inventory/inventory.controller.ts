import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { InventoryService } from "./inventory.service";
import { CreateInventoryMovementDto } from "./dto/inventory.dto";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { TenantContext } from "../../common/tenant-context";
import { RequireFeature } from "../../common/decorators/require-feature.decorator";
import { FeatureFlagGuard } from "../../common/guards/feature-flag.guard";

@Controller("bakery/inventory")
@UseGuards(FeatureFlagGuard)
@RequireFeature("featureBakery")
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Get("movements")
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query("ingredientId", new ParseUUIDPipe({ optional: true }))
    ingredientId?: string,
  ) {
    this.assertTenant(tenant);
    return this.service.listMovements(tenant.tenantId, ingredientId);
  }

  @Post("movements")
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateInventoryMovementDto,
  ) {
    this.assertTenant(tenant);
    return this.service.registerMovement(tenant.tenantId, dto);
  }

  private assertTenant(
    tenant: TenantContext | undefined,
  ): asserts tenant is TenantContext {
    if (!tenant) {
      throw new ForbiddenException("Tenant context not available");
    }
  }
}
