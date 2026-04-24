import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { CurrentTenant } from "../common/decorators/current-tenant.decorator";
import { requireTenantId } from "../common/tenant-guard";
import { ShippingCalculatorService } from "./shipping-calculator.service";
import { ShippingMethodService } from "./shipping-method.service";
import {
  CalculateShippingDto,
  CreateShippingMethodDto,
  UpdateShippingMethodDto,
} from "./dto/shipping.dto";

@Controller("shipping")
export class ShippingController {
  constructor(
    private readonly shippingMethodService: ShippingMethodService,
    private readonly shippingCalculator: ShippingCalculatorService,
  ) {}

  @Get("methods")
  async getShippingMethods(@CurrentTenant("tenantId") tenantId: string | undefined) {
    const data = await this.shippingMethodService.listMethods(
      requireTenantId(tenantId),
    );
    return { data };
  }

  @Post("methods")
  async createShippingMethod(
    @CurrentTenant("tenantId") tenantId: string | undefined,
    @Body() dto: CreateShippingMethodDto,
  ) {
    const data = await this.shippingMethodService.createMethod(
      requireTenantId(tenantId),
      dto,
    );
    return { data };
  }

  @Get("methods/:id")
  async getShippingMethod(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentTenant("tenantId") tenantId: string | undefined,
  ) {
    const data = await this.shippingMethodService.findMethod(
      requireTenantId(tenantId),
      id,
    );
    return { data };
  }

  @Put("methods/:id")
  async updateShippingMethod(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentTenant("tenantId") tenantId: string | undefined,
    @Body() dto: UpdateShippingMethodDto,
  ) {
    const data = await this.shippingMethodService.updateMethod(
      requireTenantId(tenantId),
      id,
      dto,
    );
    return { data };
  }

  @Delete("methods/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteShippingMethod(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentTenant("tenantId") tenantId: string | undefined,
  ) {
    await this.shippingMethodService.deleteMethod(requireTenantId(tenantId), id);
  }

  @Post("calculate")
  async calculateShipping(
    @CurrentTenant("tenantId") tenantId: string | undefined,
    @Body() dto: CalculateShippingDto,
  ) {
    const cep = String(dto.cepDestino ?? dto.zipCode ?? "").replace(/\D/g, "");
    if (cep.length < 8) {
      throw new BadRequestException("Invalid CEP");
    }
    let items: { productId: string; quantity: number }[];
    if (dto.items && dto.items.length > 0) {
      items = dto.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      }));
    } else if (dto.productId) {
      items = [{ productId: dto.productId, quantity: dto.quantity ?? 1 }];
    } else {
      throw new BadRequestException("productId or items is required");
    }
    const data = await this.shippingCalculator.calculateShipping(
      requireTenantId(tenantId),
      cep,
      items,
      dto.subtotal ?? 0,
    );
    return { data };
  }

  @Get("cache")
  async getCachedRates(
    @CurrentTenant("tenantId") tenantId: string | undefined,
    @Query("cep") cep: string,
  ) {
    const data = await this.shippingMethodService.getCachedRates(
      requireTenantId(tenantId),
      cep,
    );
    return { data };
  }

  @Delete("cache")
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearCache(@CurrentTenant("tenantId") tenantId: string | undefined) {
    await this.shippingMethodService.clearCache(requireTenantId(tenantId));
  }
}
