import {
  Body,
  Controller,
  Get,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { CurrentTenant } from "../common/decorators/current-tenant.decorator";
import { requireTenantId } from "../common/tenant-guard";
import { LoyaltyService } from "./loyalty.service";
import { RedeemPointsDto } from "./dto/loyalty.dto";
import {
  PointsSummary,
  PointsTransactionDetail,
  TierInfo,
} from "./loyalty.types";

const DEFAULT_TRANSACTIONS_LIMIT = 20;
const DEFAULT_TRANSACTIONS_OFFSET = 0;

@Controller("loyalty")
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get("summary")
  async getPointsSummary(
    @CurrentTenant("tenantId") tenantId: string | undefined,
    @Query("customerId", ParseUUIDPipe) customerId: string,
  ): Promise<{ data: PointsSummary }> {
    const data = await this.loyaltyService.getPointsSummary(
      requireTenantId(tenantId),
      customerId,
    );
    return { data };
  }

  @Get("transactions")
  async getTransactions(
    @CurrentTenant("tenantId") tenantId: string | undefined,
    @Query("customerId", ParseUUIDPipe) customerId: string,
    @Query("limit") limit?: number,
    @Query("offset") offset?: number,
  ): Promise<{ data: PointsTransactionDetail[] }> {
    const data = await this.loyaltyService.getTransactionHistory(
      requireTenantId(tenantId),
      customerId,
      limit ? Number(limit) : DEFAULT_TRANSACTIONS_LIMIT,
      offset ? Number(offset) : DEFAULT_TRANSACTIONS_OFFSET,
    );
    return { data };
  }

  @Post("redeem")
  async redeemPoints(
    @CurrentTenant("tenantId") tenantId: string | undefined,
    @Query("customerId", ParseUUIDPipe) customerId: string,
    @Body() dto: RedeemPointsDto,
  ) {
    return this.loyaltyService.redeemPoints(
      requireTenantId(tenantId),
      customerId,
      dto.points,
      dto.orderId,
    );
  }

  @Get("calculate")
  async calculateOrderPoints(
    @CurrentTenant("tenantId") tenantId: string | undefined,
    @Query("customerId", ParseUUIDPipe) customerId: string,
    @Query("orderTotal") orderTotal: string,
  ): Promise<{ data: number }> {
    const data = await this.loyaltyService.calculateOrderPoints(
      requireTenantId(tenantId),
      customerId,
      parseFloat(orderTotal),
    );
    return { data };
  }

  @Get("tiers")
  async getTiers(
    @CurrentTenant("tenantId") tenantId: string | undefined,
  ): Promise<{ data: TierInfo[] }> {
    const data = await this.loyaltyService.getAvailableTiers(
      requireTenantId(tenantId),
    );
    return { data };
  }
}
