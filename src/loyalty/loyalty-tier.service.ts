import { Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { DrizzleService } from "../database/drizzle.service";
import {
  customerPoints,
  customerTierRules,
} from "../database/schema";
import { DEFAULT_TIER, TIER_CONFIG, TierInfo } from "./loyalty.types";

@Injectable()
export class LoyaltyTierService {
  constructor(private readonly drizzle: DrizzleService) {}

  async getPointsMultiplier(tenantId: string, tier: string): Promise<number> {
    const rule = await this.drizzle.db.query.customerTierRules.findFirst({
      where: and(
        eq(customerTierRules.tenantId, tenantId),
        eq(customerTierRules.tier, tier),
      ),
    });
    return rule ? parseFloat(rule.pointsMultiplier) : 1;
  }

  async listTiers(tenantId: string): Promise<TierInfo[]> {
    const rules = await this.drizzle.db.query.customerTierRules.findMany({
      where: eq(customerTierRules.tenantId, tenantId),
      orderBy: desc(customerTierRules.minPoints),
    });
    return rules.map((rule) => ({
      tier: rule.tier,
      tierName: TIER_CONFIG[rule.tier]?.name ?? rule.tier,
      minPoints: rule.minPoints,
      pointsMultiplier: parseFloat(rule.pointsMultiplier),
      benefits: [...(TIER_CONFIG[rule.tier]?.benefits ?? [])],
    }));
  }

  async resolveTierForPoints(
    tenantId: string,
    lifetimeEarned: number,
  ): Promise<string> {
    const rules = await this.drizzle.db.query.customerTierRules.findMany({
      where: eq(customerTierRules.tenantId, tenantId),
      orderBy: desc(customerTierRules.minPoints),
    });
    for (const rule of rules) {
      if (lifetimeEarned >= rule.minPoints) return rule.tier;
    }
    return DEFAULT_TIER;
  }

  async syncTier(tenantId: string, customerId: string): Promise<void> {
    const pointsRow = await this.drizzle.db.query.customerPoints.findFirst({
      where: and(
        eq(customerPoints.tenantId, tenantId),
        eq(customerPoints.customerId, customerId),
      ),
    });
    if (!pointsRow) return;

    const newTier = await this.resolveTierForPoints(
      tenantId,
      pointsRow.lifetimeEarned,
    );
    if (newTier === pointsRow.tier) return;

    await this.drizzle.db
      .update(customerPoints)
      .set({ tier: newTier, updatedAt: new Date() })
      .where(eq(customerPoints.id, pointsRow.id));
  }
}
