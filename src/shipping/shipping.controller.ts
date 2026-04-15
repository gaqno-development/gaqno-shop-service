import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DrizzleService } from '../database/drizzle.service';
import { ShippingCalculatorService, CalculatedRate } from './shipping-calculator.service';
import {
  shippingMethods,
  shippingRatesCache,
  tenants,
} from '../database/schema';
import { eq, and } from 'drizzle-orm';
import { IsEmail, IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

class CreateShippingMethodDto {
  @IsString()
  name: string;

  @IsString()
  carrier: string;

  @IsOptional()
  @IsString()
  serviceCode?: string;

  @IsOptional()
  @IsNumber()
  flatRate?: number;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsNumber()
  estimatedDeliveryDaysMin?: number;

  @IsOptional()
  @IsNumber()
  estimatedDeliveryDaysMax?: number;

  @IsOptional()
  @IsNumber()
  freeShippingThreshold?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class UpdateShippingMethodDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  carrier?: string;

  @IsOptional()
  @IsString()
  serviceCode?: string;

  @IsOptional()
  @IsNumber()
  flatRate?: number;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsNumber()
  estimatedDeliveryDaysMin?: number;

  @IsOptional()
  @IsNumber()
  estimatedDeliveryDaysMax?: number;

  @IsOptional()
  @IsNumber()
  freeShippingThreshold?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class CalculateShippingDto {
  @IsString()
  cepDestino: string;

  @IsString()
  productId: string;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsNumber()
  subtotal?: number;
}

@Controller('shipping')
export class ShippingController {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly shippingCalculator: ShippingCalculatorService,
  ) {}

  @Get('methods')
  async getShippingMethods(@Query('tenantId') tenantId: string) {
    const methods = await this.drizzle.db.query.shippingMethods.findMany({
      where: and(
        eq(shippingMethods.tenantId, tenantId),
      ),
      orderBy: shippingMethods.sortOrder,
    });

    return { data: methods };
  }

  @Post('methods')
  async createShippingMethod(
    @Query('tenantId') tenantId: string,
    @Body() dto: CreateShippingMethodDto,
  ) {
    const slug = dto.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    const [method] = await this.drizzle.db
      .insert(shippingMethods)
      .values({
        tenantId,
        name: dto.name,
        slug,
        carrier: dto.carrier,
        serviceCode: dto.serviceCode || null,
        flatRate: dto.flatRate ? dto.flatRate.toString() : null,
        sortOrder: dto.sortOrder || 0,
        estimatedDeliveryDaysMin: dto.estimatedDeliveryDaysMin || 1,
        estimatedDeliveryDaysMax: dto.estimatedDeliveryDaysMax || 7,
        freeShippingThreshold: dto.freeShippingThreshold ? dto.freeShippingThreshold.toString() : null,
        isActive: dto.isActive ?? true,
      })
      .returning();

    return { data: method };
  }

  @Get('methods/:id')
  async getShippingMethod(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('tenantId') tenantId: string,
  ) {
    const method = await this.drizzle.db.query.shippingMethods.findFirst({
      where: and(
        eq(shippingMethods.id, id),
        eq(shippingMethods.tenantId, tenantId),
      ),
    });

    return { data: method };
  }

  @Put('methods/:id')
  async updateShippingMethod(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('tenantId') tenantId: string,
    @Body() dto: UpdateShippingMethodDto,
  ) {
    const updateData: Record<string, any> = { ...dto };
    
    if (updateData.flatRate !== undefined) {
      updateData.flatRate = updateData.flatRate?.toString() ?? null;
    }
    if (updateData.freeShippingThreshold !== undefined) {
      updateData.freeShippingThreshold = updateData.freeShippingThreshold?.toString() ?? null;
    }

    const [updated] = await this.drizzle.db
      .update(shippingMethods)
      .set(updateData)
      .where(
        and(
          eq(shippingMethods.id, id),
          eq(shippingMethods.tenantId, tenantId),
        ),
      )
      .returning();

    return { data: updated };
  }

  @Delete('methods/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteShippingMethod(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('tenantId') tenantId: string,
  ) {
    await this.drizzle.db
      .delete(shippingMethods)
      .where(
        and(
          eq(shippingMethods.id, id),
          eq(shippingMethods.tenantId, tenantId),
        ),
      );
  }

  @Post('calculate')
  async calculateShipping(
    @Query('tenantId') tenantId: string,
    @Body() dto: CalculateShippingDto,
  ) {
    const items = [{
      productId: dto.productId,
      quantity: dto.quantity || 1,
    }];

    const rates = await this.shippingCalculator.calculateShipping(
      tenantId,
      dto.cepDestino,
      items,
      dto.subtotal || 0,
    );

    return { data: rates };
  }

  @Get('cache')
  async getCachedRates(
    @Query('tenantId') tenantId: string,
    @Query('cep') cep: string,
  ) {
    const rates = await this.drizzle.db.query.shippingRatesCache.findMany({
      where: and(
        eq(shippingRatesCache.tenantId, tenantId),
        eq(shippingRatesCache.cep, cep.replace(/\D/g, '')),
      ),
      orderBy: shippingRatesCache.expiresAt,
    });

    return { data: rates };
  }

  @Delete('cache')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearCache(
    @Query('tenantId') tenantId: string,
  ) {
    await this.drizzle.db
      .delete(shippingRatesCache)
      .where(eq(shippingRatesCache.tenantId, tenantId));
  }
}