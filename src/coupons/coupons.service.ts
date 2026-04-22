import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DrizzleService } from "../database/drizzle.service";
import { coupons, type Coupon } from "../database/schema/coupons";
import {
  CreateCouponDto,
  UpdateCouponDto,
} from "./dto/coupon.dto";

const MAX_PERCENT = 100;

type ValidationReason =
  | "not_found"
  | "inactive"
  | "not_in_window"
  | "min_order_not_reached"
  | "max_uses_reached";

export interface CouponValidationResult {
  readonly valid: boolean;
  readonly discount: number;
  readonly reason?: ValidationReason;
  readonly coupon?: Coupon;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function toMoneyString(value: number): string {
  return value.toString();
}

function assertValidWindow(from: string, until: string): void {
  if (new Date(until).getTime() <= new Date(from).getTime()) {
    throw new BadRequestException("validUntil must be after validFrom");
  }
}

function assertValidPercentage(type: string, value: number): void {
  if (type === "percentage" && value > MAX_PERCENT) {
    throw new BadRequestException("percentage coupon cannot exceed 100");
  }
}

function computeDiscount(type: string, value: number, subtotal: number): number {
  if (type === "percentage") {
    return Math.min(subtotal, Math.round((subtotal * value) / 100 * 100) / 100);
  }
  return Math.min(subtotal, value);
}

@Injectable()
export class CouponsService {
  constructor(private readonly drizzle: DrizzleService) {}

  async list(tenantId: string): Promise<Coupon[]> {
    return this.drizzle.db.query.coupons.findMany({
      where: eq(coupons.tenantId, tenantId),
      orderBy: coupons.createdAt,
    });
  }

  async findOne(tenantId: string, id: string): Promise<Coupon> {
    const coupon = await this.drizzle.db.query.coupons.findFirst({
      where: and(eq(coupons.id, id), eq(coupons.tenantId, tenantId)),
    });
    if (!coupon) throw new NotFoundException("Coupon not found");
    return coupon;
  }

  async create(tenantId: string, dto: CreateCouponDto): Promise<Coupon> {
    assertValidWindow(dto.validFrom, dto.validUntil);
    assertValidPercentage(dto.type, dto.value);

    const [row] = await this.drizzle.db
      .insert(coupons)
      .values({
        tenantId,
        code: normalizeCode(dto.code),
        type: dto.type,
        value: toMoneyString(dto.value),
        minOrder: dto.minOrder != null ? toMoneyString(dto.minOrder) : null,
        maxUses: dto.maxUses ?? null,
        validFrom: new Date(dto.validFrom),
        validUntil: new Date(dto.validUntil),
        isActive: dto.isActive ?? true,
      })
      .returning();
    return row;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateCouponDto,
  ): Promise<Coupon> {
    if (dto.validFrom && dto.validUntil) {
      assertValidWindow(dto.validFrom, dto.validUntil);
    }
    if (dto.type && dto.value != null) {
      assertValidPercentage(dto.type, dto.value);
    }

    const payload = this.buildUpdatePayload(dto);
    const [row] = await this.drizzle.db
      .update(coupons)
      .set(payload)
      .where(and(eq(coupons.id, id), eq(coupons.tenantId, tenantId)))
      .returning();
    if (!row) throw new NotFoundException("Coupon not found");
    return row;
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await this.drizzle.db
      .delete(coupons)
      .where(and(eq(coupons.id, id), eq(coupons.tenantId, tenantId)));
  }

  async validate(
    tenantId: string,
    code: string,
    subtotal: number,
  ): Promise<CouponValidationResult> {
    const normalized = normalizeCode(code);
    const coupon = await this.drizzle.db.query.coupons.findFirst({
      where: and(eq(coupons.tenantId, tenantId), eq(coupons.code, normalized)),
    });

    if (!coupon) return { valid: false, discount: 0, reason: "not_found" };
    if (!coupon.isActive)
      return { valid: false, discount: 0, reason: "inactive", coupon };

    const now = Date.now();
    if (
      now < new Date(coupon.validFrom).getTime() ||
      now > new Date(coupon.validUntil).getTime()
    ) {
      return { valid: false, discount: 0, reason: "not_in_window", coupon };
    }

    const minOrder = coupon.minOrder != null ? Number(coupon.minOrder) : null;
    if (minOrder != null && subtotal < minOrder) {
      return {
        valid: false,
        discount: 0,
        reason: "min_order_not_reached",
        coupon,
      };
    }

    if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
      return { valid: false, discount: 0, reason: "max_uses_reached", coupon };
    }

    const discount = computeDiscount(coupon.type, Number(coupon.value), subtotal);
    return { valid: true, discount, coupon };
  }

  private buildUpdatePayload(dto: UpdateCouponDto): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    if (dto.code != null) payload.code = normalizeCode(dto.code);
    if (dto.type != null) payload.type = dto.type;
    if (dto.value != null) payload.value = toMoneyString(dto.value);
    if (dto.minOrder !== undefined) {
      payload.minOrder = dto.minOrder != null ? toMoneyString(dto.minOrder) : null;
    }
    if (dto.maxUses !== undefined) payload.maxUses = dto.maxUses ?? null;
    if (dto.validFrom != null) payload.validFrom = new Date(dto.validFrom);
    if (dto.validUntil != null) payload.validUntil = new Date(dto.validUntil);
    if (dto.isActive != null) payload.isActive = dto.isActive;
    payload.updatedAt = new Date();
    return payload;
  }
}
