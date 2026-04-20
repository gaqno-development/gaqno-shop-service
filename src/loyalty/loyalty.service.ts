import { Injectable } from "@nestjs/common";
import { LoyaltyPointsService } from "./loyalty-points.service";
import { LoyaltyTierService } from "./loyalty-tier.service";
import {
  PointsSummary,
  PointsTransactionDetail,
  TierInfo,
} from "./loyalty.types";

@Injectable()
export class LoyaltyService {
  constructor(
    private readonly pointsService: LoyaltyPointsService,
    private readonly tierService: LoyaltyTierService,
  ) {}

  getPointsSummary(
    tenantId: string,
    customerId: string,
  ): Promise<PointsSummary> {
    return this.pointsService.getSummary(tenantId, customerId);
  }

  getTransactionHistory(
    tenantId: string,
    customerId: string,
    limit?: number,
    offset?: number,
  ): Promise<PointsTransactionDetail[]> {
    return this.pointsService.getTransactions(tenantId, customerId, limit, offset);
  }

  earnPointsFromOrder(
    tenantId: string,
    customerId: string,
    orderId: string,
    orderTotal: number,
  ): Promise<number> {
    return this.pointsService.earnFromOrder(
      tenantId,
      customerId,
      orderId,
      orderTotal,
    );
  }

  redeemPoints(
    tenantId: string,
    customerId: string,
    pointsToRedeem: number,
    orderId?: string,
  ) {
    return this.pointsService.redeem(
      tenantId,
      customerId,
      pointsToRedeem,
      orderId,
    );
  }

  getAvailableTiers(tenantId: string): Promise<TierInfo[]> {
    return this.tierService.listTiers(tenantId);
  }

  calculateOrderPoints(
    tenantId: string,
    customerId: string,
    orderTotal: number,
  ): Promise<number> {
    return this.pointsService.calculateOrderPoints(
      tenantId,
      customerId,
      orderTotal,
    );
  }

  checkAndUpdateTier(tenantId: string, customerId: string): Promise<void> {
    return this.tierService.syncTier(tenantId, customerId);
  }
}
