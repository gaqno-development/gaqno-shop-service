import { Injectable } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import { DrizzleService } from "../database/drizzle.service";
import { products, shippingMethods } from "../database/schema";
import { ShippingCacheService } from "./shipping-cache.service";
import { ShippingCarrierService } from "./shipping-carrier.service";
import { calculateTotalDimensions } from "./shipping-dimensions.util";
import { qualifiesForFreeShipping } from "./shipping-free.util";
import {
  CalculatedRate,
  ShippingItem,
  ShippingMethodRow,
} from "./shipping.types";

@Injectable()
export class ShippingCalculatorService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly carrierService: ShippingCarrierService,
    private readonly cacheService: ShippingCacheService,
  ) {}

  async calculateShipping(
    tenantId: string,
    cepDestino: string,
    items: readonly ShippingItem[],
    subtotal: number,
    customerTier?: string,
  ): Promise<CalculatedRate[]> {
    const cacheKey = this.cacheService.buildCacheKey(tenantId, cepDestino, items);
    const cached = await this.cacheService.findValid(tenantId, cacheKey);
    if (cached) return cached;

    const methods = await this.loadActiveMethods(tenantId);
    const productIds = items.map((item) => item.productId);
    const productData = await this.loadProducts(tenantId, productIds);
    const dimensions = calculateTotalDimensions(items, productData);

    const rates: CalculatedRate[] = [];
    for (const method of methods) {
      const rate = await this.tryCalculateForMethod(
        method,
        cepDestino,
        dimensions,
        subtotal,
        customerTier,
      );
      if (rate) rates.push(rate);
    }

    await this.cacheService.store(tenantId, cacheKey, cepDestino, productIds, rates);
    return rates;
  }

  private async tryCalculateForMethod(
    method: ShippingMethodRow,
    cepDestino: string,
    dimensions: ReturnType<typeof calculateTotalDimensions>,
    subtotal: number,
    customerTier?: string,
  ): Promise<CalculatedRate | null> {
    try {
      const rate = await this.carrierService.calculateForMethod(
        method,
        cepDestino,
        dimensions,
        subtotal,
      );
      if (!rate) return null;
      if (qualifiesForFreeShipping(method, subtotal, customerTier)) {
        return { ...rate, originalPrice: rate.price, price: 0, isFreeShipping: true };
      }
      return rate;
    } catch (error) {
      console.error(`Error calculating rate for ${method.name}:`, error);
      return null;
    }
  }

  private async loadActiveMethods(tenantId: string) {
    return this.drizzle.db.query.shippingMethods.findMany({
      where: and(
        eq(shippingMethods.tenantId, tenantId),
        eq(shippingMethods.isActive, true),
      ),
      orderBy: shippingMethods.sortOrder,
    });
  }

  private async loadProducts(tenantId: string, productIds: readonly string[]) {
    if (productIds.length === 0) return [];
    return this.drizzle.db.query.products.findMany({
      where: and(
        eq(products.tenantId, tenantId),
        inArray(products.id, [...productIds]),
      ),
    });
  }
}
