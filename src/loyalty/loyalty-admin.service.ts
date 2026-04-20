import { Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { DrizzleService } from "../database/drizzle.service";
import {
  customerPoints,
  customerTierRules,
  pointsTransactions,
} from "../database/schema";
import { LoyaltyPointsService } from "./loyalty-points.service";
import {
  AdjustPointsDto,
  CreateTierRuleDto,
  UpdateTierRuleDto,
} from "./dto/loyalty.dto";

export interface AdjustResult {
  success: boolean;
  newBalance?: number;
  message?: string;
}

const DEFAULT_MULTIPLIER = "1.00";

@Injectable()
export class LoyaltyAdminService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly pointsService: LoyaltyPointsService,
  ) {}

  async listCustomerPoints(tenantId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    return this.drizzle.db.query.customerPoints.findMany({
      where: eq(customerPoints.tenantId, tenantId),
      orderBy: [desc(customerPoints.balance)],
      limit,
      offset,
    });
  }

  async listTierRules(tenantId: string) {
    return this.drizzle.db.query.customerTierRules.findMany({
      where: eq(customerTierRules.tenantId, tenantId),
      orderBy: [desc(customerTierRules.minPoints)],
    });
  }

  async createTierRule(tenantId: string, dto: CreateTierRuleDto) {
    const [rule] = await this.drizzle.db
      .insert(customerTierRules)
      .values({
        tenantId,
        tier: dto.tier,
        minPoints: dto.minPoints,
        pointsMultiplier: dto.pointsMultiplier?.toString() ?? DEFAULT_MULTIPLIER,
      })
      .returning();
    return rule;
  }

  async updateTierRule(
    tenantId: string,
    id: string,
    dto: UpdateTierRuleDto,
  ) {
    const payload: {
      tier?: string;
      minPoints?: number;
      pointsMultiplier?: string;
      updatedAt: Date;
    } = { updatedAt: new Date() };
    if (dto.tier !== undefined) payload.tier = dto.tier;
    if (dto.minPoints !== undefined) payload.minPoints = dto.minPoints;
    if (dto.pointsMultiplier !== undefined) {
      payload.pointsMultiplier = dto.pointsMultiplier.toString();
    }

    const [updated] = await this.drizzle.db
      .update(customerTierRules)
      .set(payload)
      .where(
        and(
          eq(customerTierRules.id, id),
          eq(customerTierRules.tenantId, tenantId),
        ),
      )
      .returning();
    return updated;
  }

  async adjustPoints(
    tenantId: string,
    customerId: string,
    dto: AdjustPointsDto,
  ): Promise<AdjustResult> {
    const points = await this.pointsService.getOrCreatePoints(
      tenantId,
      customerId,
    );
    const newBalance = points.balance + dto.amount;
    if (newBalance < 0) {
      return { success: false, message: "Saldo não pode ser negativo" };
    }

    await this.drizzle.db.transaction(async (tx) => {
      if (dto.amount > 0) {
        await tx
          .update(customerPoints)
          .set({
            balance: newBalance,
            lifetimeEarned: points.lifetimeEarned + dto.amount,
          })
          .where(eq(customerPoints.id, points.id));
      } else {
        await tx
          .update(customerPoints)
          .set({
            balance: newBalance,
            lifetimeRedeemed: points.lifetimeRedeemed + Math.abs(dto.amount),
          })
          .where(eq(customerPoints.id, points.id));
      }
      await tx.insert(pointsTransactions).values({
        tenantId,
        customerId,
        type: dto.amount > 0 ? "bonus" : "adjustment",
        amount: dto.amount,
        description: dto.description,
      });
    });

    return { success: true, newBalance };
  }
}
