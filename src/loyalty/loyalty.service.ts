import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../database/drizzle.service';
import {
  customerPoints,
  pointsTransactions,
  pointsRedemptionHistory,
  customerTierRules,
  customers,
  orders,
  orderItems,
} from '../database/schema';
import { eq, and, gt, gte, desc } from 'drizzle-orm';

export interface PointsSummary {
  balance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  tier: string;
  tierExpiresAt: Date | null;
}

export interface PointsTransactionDetail {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  referenceId: string | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface TierInfo {
  tier: string;
  tierName: string;
  minPoints: number;
  pointsMultiplier: number;
  benefits: string[];
}

const TIER_CONFIG: Record<string, { name: string; benefits: string[] }> = {
  bronze: { name: 'Bronze', benefits: ['Pontuação padrão 1x'] },
  silver: { name: 'Prata', benefits: ['Pontuação 1.25x', 'Frete grátis acima de R$99'] },
  gold: { name: 'Ouro', benefits: ['Pontuação 1.5x', 'Frete grátis acima de R$99', '5% de desconto em datas especiais'] },
  platinum: { name: 'Platina', benefits: ['Pontuação 2x', 'Frete grátis', '10% de desconto固定', 'Atendimento prioritário'] },
};

@Injectable()
export class LoyaltyService {
  constructor(private readonly drizzle: DrizzleService) {}

  async getOrCreatePoints(tenantId: string, customerId: string) {
    const db = this.drizzle.db;
    
    let points = await db.query.customerPoints.findFirst({
      where: and(
        eq(customerPoints.tenantId, tenantId),
        eq(customerPoints.customerId, customerId)
      ),
    });

    if (!points) {
      const [created] = await db.insert(customerPoints).values({
        tenantId,
        customerId,
        balance: 0,
        lifetimeEarned: 0,
        lifetimeRedeemed: 0,
        tier: 'bronze',
      }).returning();
      
      points = created;
    }

    return points;
  }

  async getPointsSummary(tenantId: string, customerId: string): Promise<PointsSummary> {
    const points = await this.getOrCreatePoints(tenantId, customerId);
    
    return {
      balance: points.balance,
      lifetimeEarned: points.lifetimeEarned,
      lifetimeRedeemed: points.lifetimeRedeemed,
      tier: points.tier,
      tierExpiresAt: points.tierExpiresAt,
    };
  }

  async getTransactionHistory(
    tenantId: string,
    customerId: string,
    limit = 20,
    offset = 0
  ): Promise<PointsTransactionDetail[]> {
    const db = this.drizzle.db;
    
    const transactions = await db.query.pointsTransactions.findMany({
      where: and(
        eq(pointsTransactions.tenantId, tenantId),
        eq(pointsTransactions.customerId, customerId)
      ),
      orderBy: [desc(pointsTransactions.createdAt)],
      limit,
      offset,
    });

    return transactions.map(t => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      description: t.description,
      referenceId: t.referenceId,
      expiresAt: t.expiresAt,
      createdAt: t.createdAt,
    }));
  }

  async earnPointsFromOrder(
    tenantId: string,
    customerId: string,
    orderId: string,
    orderTotal: number
  ): Promise<number> {
    const db = this.drizzle.db;
    
    const pointsData = await this.getOrCreatePoints(tenantId, customerId);
    const multiplier = await this.getPointsMultiplier(tenantId, pointsData.tier);
    
    const pointsEarned = Math.floor(orderTotal * multiplier);
    
    if (pointsEarned <= 0) return 0;

    await db.transaction(async (tx) => {
      await tx.insert(pointsTransactions).values({
        tenantId,
        customerId,
        orderId,
        type: 'earn',
        amount: pointsEarned,
        description: `Pedido #${orderId.slice(0, 8)}`,
      });

      await tx.update(customerPoints).set({
        balance: pointsData.balance + pointsEarned,
        lifetimeEarned: pointsData.lifetimeEarned + pointsEarned,
      }).where(eq(customerPoints.id, pointsData.id));
    });

    await this.checkAndUpdateTier(tenantId, customerId);

    return pointsEarned;
  }

  async redeemPoints(
    tenantId: string,
    customerId: string,
    pointsToRedeem: number,
    orderId?: string
  ): Promise<{ success: boolean; discount: number; message: string }> {
    const db = this.drizzle.db;
    
    const pointsData = await this.getOrCreatePoints(tenantId, customerId);
    
    if (pointsToRedeem > pointsData.balance) {
      return { success: false, discount: 0, message: 'Saldo insuficiente de pontos' };
    }

    const discount = this.calculateDiscount(pointsToRedeem);

    await db.transaction(async (tx) => {
      await tx.insert(pointsTransactions).values({
        tenantId,
        customerId,
        orderId: orderId || null,
        type: 'redeem',
        amount: -pointsToRedeem,
        description: `Resgate de pontos`,
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

      await tx.update(customerPoints).set({
        balance: pointsData.balance - pointsToRedeem,
        lifetimeRedeemed: pointsData.lifetimeRedeemed + pointsToRedeem,
      }).where(eq(customerPoints.id, pointsData.id));
    });

    return { success: true, discount, message: `${pointsToRedeem} pontos convertidos em R$ ${discount.toFixed(2)} de desconto` };
  }

  private calculateDiscount(points: number): number {
    const REDEEM_RATE = 0.01;
    return points * REDEEM_RATE;
  }

  async getPointsMultiplier(tenantId: string, tier: string): Promise<number> {
    const db = this.drizzle.db;
    
    const rule = await db.query.customerTierRules.findFirst({
      where: and(
        eq(customerTierRules.tenantId, tenantId),
        eq(customerTierRules.tier, tier)
      ),
    });

    return rule ? parseFloat(rule.pointsMultiplier) : 1;
  }

  private async getTierConfig(tenantId: string, tier: string) {
    const db = this.drizzle.db;
    
    return db.query.customerTierRules.findFirst({
      where: and(
        eq(customerTierRules.tenantId, tenantId),
        eq(customerTierRules.tier, tier)
      ),
    });
  }

  async checkAndUpdateTier(tenantId: string, customerId: string) {
    const db = this.drizzle.db;
    
    const pointsData = await this.getOrCreatePoints(tenantId, customerId);
    
    const rules = await db.query.customerTierRules.findMany({
      where: eq(customerTierRules.tenantId, tenantId),
      orderBy: desc(customerTierRules.minPoints),
    });

    let newTier = 'bronze';
    for (const rule of rules) {
      if (pointsData.lifetimeEarned >= rule.minPoints) {
        newTier = rule.tier;
        break;
      }
    }

    if (newTier !== pointsData.tier) {
      await db.update(customerPoints).set({
        tier: newTier,
        updatedAt: new Date(),
      }).where(eq(customerPoints.id, pointsData.id));
    }
  }

  async getAvailableTiers(tenantId: string): Promise<TierInfo[]> {
    const db = this.drizzle.db;
    
    const rules = await db.query.customerTierRules.findMany({
      where: eq(customerTierRules.tenantId, tenantId),
      orderBy: desc(customerTierRules.minPoints),
    });

    return rules.map(rule => ({
      tier: rule.tier,
      tierName: TIER_CONFIG[rule.tier]?.name || rule.tier,
      minPoints: rule.minPoints,
      pointsMultiplier: parseFloat(rule.pointsMultiplier),
      benefits: TIER_CONFIG[rule.tier]?.benefits || [],
    }));
  }

  async calculateOrderPoints(tenantId: string, customerId: string, orderTotal: number): Promise<number> {
    const pointsData = await this.getOrCreatePoints(tenantId, customerId);
    const multiplier = await this.getPointsMultiplier(tenantId, pointsData.tier);
    return Math.floor(orderTotal * multiplier);
  }
}