import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../database/drizzle.service';
import { CorreiosService } from './correios.service';
import { JadlogService } from './jadlog.service';
import { shippingMethods, shippingRatesCache, products } from '../database/schema';
import { eq, and, gt, inArray } from 'drizzle-orm';
import { createHash } from 'crypto';

interface ShippingItem {
  productId: string;
  quantity: number;
}

export interface CalculatedRate {
  methodId: string;
  name: string;
  carrier: string;
  price: number;
  originalPrice?: number;
  days: { min: number; max: number };
  isFreeShipping: boolean;
}

@Injectable()
export class ShippingCalculatorService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly correiosService: CorreiosService,
    private readonly jadlogService: JadlogService,
  ) {}

  async calculateShipping(
    tenantId: string,
    cepDestino: string,
    items: ShippingItem[],
    subtotal: number,
    customerTier?: string,
  ): Promise<CalculatedRate[]> {
    const db = this.drizzle.db;

    // Check cache first
    const cacheKey = this.generateCacheKey(tenantId, cepDestino, items);
    const cached = await db.query.shippingRatesCache.findFirst({
      where: and(
        eq(shippingRatesCache.tenantId, tenantId),
        eq(shippingRatesCache.cacheKey, cacheKey),
        gt(shippingRatesCache.expiresAt, new Date())
      ),
    });

    if (cached) {
      return cached.rates as CalculatedRate[];
    }

    // Get active shipping methods
    const methods = await db.query.shippingMethods.findMany({
      where: and(
        eq(shippingMethods.tenantId, tenantId),
        eq(shippingMethods.isActive, true)
      ),
      orderBy: shippingMethods.sortOrder,
    });

    // Get product dimensions
    const productIds = items.map(item => item.productId);
    const productData = await db.query.products.findMany({
      where: and(
        eq(products.tenantId, tenantId),
        inArray(products.id, productIds)
      ),
    });

    // Calculate total dimensions
    const totalDimensions = this.calculateTotalDimensions(items, productData);

    // Calculate rates for each method
    const rates: CalculatedRate[] = [];

    for (const method of methods) {
      try {
        let rate: CalculatedRate | null = null;

        if (method.carrier === 'correios') {
          rate = await this.calculateCorreiosRate(method, cepDestino, totalDimensions);
        } else if (method.carrier === 'jadlog') {
          rate = await this.calculateJadlogRate(method, cepDestino, totalDimensions, subtotal);
        } else if (method.carrier === 'custom' && method.flatRate) {
          rate = {
            methodId: method.id,
            name: method.name,
            carrier: method.carrier,
            price: parseFloat(method.flatRate),
            days: {
              min: method.estimatedDeliveryDaysMin || 1,
              max: method.estimatedDeliveryDaysMax || 7,
            },
            isFreeShipping: false,
          };
        }

        if (rate) {
          // Apply free shipping logic
          const qualifiesForFreeShipping = this.checkFreeShipping(
            method,
            subtotal,
            customerTier
          );

          if (qualifiesForFreeShipping) {
            rate.originalPrice = rate.price;
            rate.price = 0;
            rate.isFreeShipping = true;
          }

          rates.push(rate);
        }
      } catch (error) {
        console.error(`Error calculating rate for ${method.name}:`, error);
      }
    }

    // Cache results
    await db.insert(shippingRatesCache).values({
      tenantId,
      cacheKey,
      cep: cepDestino.replace(/\D/g, ''),
      productIds,
      rates,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour cache
    });

    return rates;
  }

  private async calculateCorreiosRate(
    method: any,
    cepDestino: string,
    dimensions: any,
  ): Promise<CalculatedRate | null> {
    const originCep = method.settings?.originCep || '01310100';
    const servicos = method.serviceCode ? [method.serviceCode] : ['40010', '41106'];

    const results = await this.correiosService.calculateShipping(
      originCep,
      cepDestino,
      dimensions,
      servicos,
    );

    const result = results.find(r => r.code === method.serviceCode) || results[0];

    if (!result || result.error) {
      return null;
    }

    return {
      methodId: method.id,
      name: method.name,
      carrier: 'correios',
      price: result.price,
      days: {
        min: result.days,
        max: result.days + 2,
      },
      isFreeShipping: false,
    };
  }

  private async calculateJadlogRate(
    method: any,
    cepDestino: string,
    dimensions: any,
    subtotal: number,
  ): Promise<CalculatedRate | null> {
    const originCep = method.settings?.originCep || '01310100';

    const results = await this.jadlogService.calculateShipping({
      cepOrigem: originCep,
      cepDestino,
      vlMercadoria: subtotal,
      psReal: dimensions.weight,
    });

    const result = results.find(r => r.code === method.serviceCode) || results[0];

    if (!result) {
      return null;
    }

    return {
      methodId: method.id,
      name: method.name,
      carrier: 'jadlog',
      price: result.price,
      days: {
        min: result.days,
        max: result.days + 1,
      },
      isFreeShipping: false,
    };
  }

  private calculateTotalDimensions(items: ShippingItem[], productData: any[]) {
    let totalWeight = 0;
    let maxLength = 0;
    let maxWidth = 0;
    let maxHeight = 0;
    let volume = 0;

    for (const item of items) {
      const product = productData.find(p => p.id === item.productId);
      if (!product) continue;

      const weight = parseFloat(product.weight || '0') || 0.5;
      const quantity = item.quantity;

      totalWeight += weight * quantity;

      const length = product.attributes?.length || 16;
      const width = product.attributes?.width || 11;
      const height = product.attributes?.height || 2;

      volume += length * width * height * quantity;

      maxLength = Math.max(maxLength, length);
      maxWidth = Math.max(maxWidth, width);
      maxHeight = Math.max(maxHeight, height);
    }

    totalWeight = Math.min(totalWeight, 30);

    const cubicRoot = Math.cbrt(volume);
    const estimatedLength = Math.max(maxLength, Math.min(cubicRoot * 1.2, 100));
    const estimatedWidth = Math.max(maxWidth, Math.min(cubicRoot, 100));
    const estimatedHeight = Math.max(maxHeight, Math.min(volume / (estimatedLength * estimatedWidth), 100));

    return {
      weight: Math.max(totalWeight, 0.3),
      length: Math.min(estimatedLength, 105),
      width: Math.min(estimatedWidth, 105),
      height: Math.min(estimatedHeight, 105),
    };
  }

  private checkFreeShipping(
    method: any,
    subtotal: number,
    customerTier?: string,
  ): boolean {
    if (customerTier && ['silver', 'gold', 'platinum'].includes(customerTier.toLowerCase())) {
      if (subtotal >= 99) {
        return true;
      }
    }

    if (method.freeShippingThreshold && subtotal >= parseFloat(method.freeShippingThreshold)) {
      return true;
    }

    return false;
  }

  private generateCacheKey(tenantId: string, cep: string, items: ShippingItem[]): string {
    const data = JSON.stringify({ tenantId, cep, items });
    return createHash('sha256').update(data).digest('hex');
  }
}
