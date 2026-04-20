import {
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
  async getShippingMethods(@Query("tenantId") tenantId: string) {
    const data = await this.shippingMethodService.listMethods(tenantId);
    return { data };
  }

  @Post("methods")
  async createShippingMethod(
    @Query("tenantId") tenantId: string,
    @Body() dto: CreateShippingMethodDto,
  ) {
    const data = await this.shippingMethodService.createMethod(tenantId, dto);
    return { data };
  }

  @Get("methods/:id")
  async getShippingMethod(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("tenantId") tenantId: string,
  ) {
    const data = await this.shippingMethodService.findMethod(tenantId, id);
    return { data };
  }

  @Put("methods/:id")
  async updateShippingMethod(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("tenantId") tenantId: string,
    @Body() dto: UpdateShippingMethodDto,
  ) {
    const data = await this.shippingMethodService.updateMethod(tenantId, id, dto);
    return { data };
  }

  @Delete("methods/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteShippingMethod(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("tenantId") tenantId: string,
  ) {
    await this.shippingMethodService.deleteMethod(tenantId, id);
  }

  @Post("calculate")
  async calculateShipping(
    @Query("tenantId") tenantId: string,
    @Body() dto: CalculateShippingDto,
  ) {
    const items = [{ productId: dto.productId, quantity: dto.quantity ?? 1 }];
    const data = await this.shippingCalculator.calculateShipping(
      tenantId,
      dto.cepDestino,
      items,
      dto.subtotal ?? 0,
    );
    return { data };
  }

  @Get("cache")
  async getCachedRates(
    @Query("tenantId") tenantId: string,
    @Query("cep") cep: string,
  ) {
    const data = await this.shippingMethodService.getCachedRates(tenantId, cep);
    return { data };
  }

  @Delete("cache")
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearCache(@Query("tenantId") tenantId: string) {
    await this.shippingMethodService.clearCache(tenantId);
  }
}
