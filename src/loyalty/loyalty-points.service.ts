import { Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { DrizzleService } from "../database/drizzle.service";
import {
  customerPoints,
  pointsRedemptionHistory,
  pointsTransactions,
} from "../database/schema";
import { LoyaltyTierService } from "./loyalty-tier.service";
import {
  DEFAULT_TIER,
  POINTS_REDEEM_RATE,
  PointsSummary,
  PointsTransactionDetail,
} from "./loyalty.types";

export interface RedeemResult {
  success: boolean;
  discount: number;
  message: string;
}

@Injectable()
export class LoyaltyPointsService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly tierService: LoyaltyTierService,
  ) {}

  async getOrCreatePoints(tenantId: string, customerId: string) {
    const existing = await this.drizzle.db.query.customerPoints.findFirst({
      where: and(
        eq(customerPoints.tenantId, tenantId),
        eq(customerPoints.customerId, customerId),
      ),
    });
    if (existing) return existing;

    const [created] = await this.drizzle.db
      .insert(customerPoints)
      .values({
        tenantId,
        customerId,
        balance: 0,
        lifetimeEarned: 0,
        lifetimeRedeemed: 0,
        tier: DEFAULT_TIER,
      })
      .returning();
    return created;
  }

  async getSummary(
    tenantId: string,
    customerId: string,
  ): Promise<PointsSummary> {
    const points = await this.getOrCreatePoints(tenantId, customerId);
    return {
      balance: points.balance,
      lifetimeEarned: points.lifetimeEarned,
      lifetimeRedeemed: points.lifetimeRedeemed,
      tier: points.tier,
      tierExpiresAt: points.tierExpiresAt,
    };
  }

  async getTransactions(
    tenantId: string,
    customerId: string,
    limit = 20,
    offset = 0,
  ): Promise<PointsTransactionDetail[]> {
    const rows = await this.drizzle.db.query.pointsTransactions.findMany({
      where: and(
        eq(pointsTransactions.tenantId, tenantId),
        eq(pointsTransactions.customerId, customerId),
      ),
      orderBy: [desc(pointsTransactions.createdAt)],
      limit,
      offset,
    });
    return rows.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      description: t.description,
      referenceId: t.referenceId,
      expiresAt: t.expiresAt,
      createdAt: t.createdAt,
    }));
  }

  async earnFromOrder(
    tenantId: string,
    customerId: string,
    orderId: string,
    orderTotal: number,
  ): Promise<number> {
    const pointsRow = await this.getOrCreatePoints(tenantId, customerId);
    const multiplier = await this.tierService.getPointsMultiplier(
      tenantId,
      pointsRow.tier,
    );
    const pointsEarned = Math.floor(orderTotal * multiplier);
    if (pointsEarned <= 0) return 0;

    await this.drizzle.db.transaction(async (tx) => {
      await tx.insert(pointsTransactions).values({
        tenantId,
        customerId,
        orderId,
        type: "earn",
        amount: pointsEarned,
        description: `Pedido #${orderId.slice(0, 8)}`,
      });
      await tx
        .update(customerPoints)
        .set({
          balance: pointsRow.balance + pointsEarned,
          lifetimeEarned: pointsRow.lifetimeEarned + pointsEarned,
        })
        .where(eq(customerPoints.id, pointsRow.id));
    });

    await this.tierService.syncTier(tenantId, customerId);
    return pointsEarned;
  }

  async redeem(
    tenantId: string,
    customerId: string,
    pointsToRedeem: number,
    orderId?: string,
  ): Promise<RedeemResult> {
    const pointsRow = await this.getOrCreatePoints(tenantId, customerId);
    if (pointsToRedeem > pointsRow.balance) {
      return {
        success: false,
        discount: 0,
        message: "Saldo insuficiente de pontos",
      };
    }
    const discount = pointsToRedeem * POINTS_REDEEM_RATE;

    await this.drizzle.db.transaction(async (tx) => {
      await tx.insert(pointsTransactions).values({
        tenantId,
        customerId,
        orderId: orderId ?? null,
        type: "redeem",
        amount: -pointsToRedeem,
        description: "Resgate de pontos",
      });
      if (orderId) {
        await tx.insert(pointsRedemptionHistory).values({
          tenantId,
          customerId,
          orderId,
          pointsRedeemed: pointsToRedeem,
          discountReceived: discount.toString(),
        });
      }
      await tx
        .update(customerPoints)
        .set({
          balance: pointsRow.balance - pointsToRedeem,
          lifetimeRedeemed: pointsRow.lifetimeRedeemed + pointsToRedeem,
        })
        .where(eq(customerPoints.id, pointsRow.id));
    });

    return {
      success: true,
      discount,
      message: `${pointsToRedeem} pontos convertidos em R$ ${discount.toFixed(2)} de desconto`,
    };
  }

  async calculateOrderPoints(
    tenantId: string,
    customerId: string,
    orderTotal: number,
  ): Promise<number> {
    const pointsRow = await this.getOrCreatePoints(tenantId, customerId);
    const multiplier = await this.tierService.getPointsMultiplier(
      tenantId,
      pointsRow.tier,
    );
    return Math.floor(orderTotal * multiplier);
  }
}
