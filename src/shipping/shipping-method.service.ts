import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DrizzleService } from "../database/drizzle.service";
import {
  shippingMethods,
  shippingRatesCache,
} from "../database/schema";
import { slugify } from "../common/utils/slugify";
import {
  CreateShippingMethodDto,
  UpdateShippingMethodDto,
} from "./dto/shipping.dto";

const DEFAULT_DELIVERY_MIN_DAYS = 1;
const DEFAULT_DELIVERY_MAX_DAYS = 7;
const CEP_DIGITS_PATTERN = /\D/g;

@Injectable()
export class ShippingMethodService {
  constructor(private readonly drizzle: DrizzleService) {}

  async listMethods(tenantId: string) {
    return this.drizzle.db.query.shippingMethods.findMany({
      where: and(eq(shippingMethods.tenantId, tenantId)),
      orderBy: shippingMethods.sortOrder,
    });
  }

  async findMethod(tenantId: string, id: string) {
    return this.drizzle.db.query.shippingMethods.findFirst({
      where: and(
        eq(shippingMethods.id, id),
        eq(shippingMethods.tenantId, tenantId),
      ),
    });
  }

  async createMethod(tenantId: string, dto: CreateShippingMethodDto) {
    const [method] = await this.drizzle.db
      .insert(shippingMethods)
      .values({
        tenantId,
        name: dto.name,
        slug: slugify(dto.name),
        carrier: dto.carrier,
        serviceCode: dto.serviceCode ?? null,
        flatRate: dto.flatRate != null ? dto.flatRate.toString() : null,
        sortOrder: dto.sortOrder ?? 0,
        estimatedDeliveryDaysMin:
          dto.estimatedDeliveryDaysMin ?? DEFAULT_DELIVERY_MIN_DAYS,
        estimatedDeliveryDaysMax:
          dto.estimatedDeliveryDaysMax ?? DEFAULT_DELIVERY_MAX_DAYS,
        freeShippingThreshold:
          dto.freeShippingThreshold != null
            ? dto.freeShippingThreshold.toString()
            : null,
        isActive: dto.isActive ?? true,
      })
      .returning();

    return method;
  }

  async updateMethod(
    tenantId: string,
    id: string,
    dto: UpdateShippingMethodDto,
  ) {
    const payload = this.buildUpdatePayload(dto);
    const [updated] = await this.drizzle.db
      .update(shippingMethods)
      .set(payload)
      .where(
        and(
          eq(shippingMethods.id, id),
          eq(shippingMethods.tenantId, tenantId),
        ),
      )
      .returning();
    return updated;
  }

  async deleteMethod(tenantId: string, id: string): Promise<void> {
    await this.drizzle.db
      .delete(shippingMethods)
      .where(
        and(
          eq(shippingMethods.id, id),
          eq(shippingMethods.tenantId, tenantId),
        ),
      );
  }

  async getCachedRates(tenantId: string, cep: string) {
    const sanitizedCep = cep.replace(CEP_DIGITS_PATTERN, "");
    return this.drizzle.db.query.shippingRatesCache.findMany({
      where: and(
        eq(shippingRatesCache.tenantId, tenantId),
        eq(shippingRatesCache.cep, sanitizedCep),
      ),
      orderBy: shippingRatesCache.expiresAt,
    });
  }

  async clearCache(tenantId: string): Promise<void> {
    await this.drizzle.db
      .delete(shippingRatesCache)
      .where(eq(shippingRatesCache.tenantId, tenantId));
  }

  private buildUpdatePayload(dto: UpdateShippingMethodDto) {
    const payload: Record<string, unknown> = { ...dto };
    if ("flatRate" in dto) {
      payload.flatRate = dto.flatRate != null ? dto.flatRate.toString() : null;
    }
    if ("freeShippingThreshold" in dto) {
      payload.freeShippingThreshold =
        dto.freeShippingThreshold != null
          ? dto.freeShippingThreshold.toString()
          : null;
    }
    return payload;
  }
}
