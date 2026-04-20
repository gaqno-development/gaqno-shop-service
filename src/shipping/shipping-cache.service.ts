import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { and, eq, gt } from "drizzle-orm";
import { DrizzleService } from "../database/drizzle.service";
import { shippingRatesCache } from "../database/schema";
import { CalculatedRate, ShippingItem } from "./shipping.types";

const ONE_HOUR_MS = 60 * 60 * 1000;
const CEP_DIGITS_PATTERN = /\D/g;

@Injectable()
export class ShippingCacheService {
  constructor(private readonly drizzle: DrizzleService) {}

  buildCacheKey(
    tenantId: string,
    cep: string,
    items: readonly ShippingItem[],
  ): string {
    const payload = JSON.stringify({ tenantId, cep, items });
    return createHash("sha256").update(payload).digest("hex");
  }

  async findValid(
    tenantId: string,
    cacheKey: string,
  ): Promise<CalculatedRate[] | null> {
    const cached = await this.drizzle.db.query.shippingRatesCache.findFirst({
      where: and(
        eq(shippingRatesCache.tenantId, tenantId),
        eq(shippingRatesCache.cacheKey, cacheKey),
        gt(shippingRatesCache.expiresAt, new Date()),
      ),
    });
    if (!cached) return null;
    return cached.rates as CalculatedRate[];
  }

  async store(
    tenantId: string,
    cacheKey: string,
    cep: string,
    productIds: readonly string[],
    rates: readonly CalculatedRate[],
  ): Promise<void> {
    await this.drizzle.db.insert(shippingRatesCache).values({
      tenantId,
      cacheKey,
      cep: cep.replace(CEP_DIGITS_PATTERN, ""),
      productIds: [...productIds],
      rates: [...rates],
      expiresAt: new Date(Date.now() + ONE_HOUR_MS),
    });
  }
}
