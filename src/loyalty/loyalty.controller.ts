import {
  Body,
  Controller,
  Get,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { LoyaltyService } from "./loyalty.service";
import { RedeemPointsDto } from "./dto/loyalty.dto";
import {
  PointsSummary,
  PointsTransactionDetail,
  TierInfo,
} from "./loyalty.types";

@Controller("loyalty")
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get("summary")
  async getPointsSummary(
    @Query("tenantId") tenantId: string,
    @Query("customerId", ParseUUIDPipe) customerId: string,
  ): Promise<{ data: PointsSummary }> {
    const data = await this.loyaltyService.getPointsSummary(tenantId, customerId);
    return { data };
  }

  @Get("transactions")
  async getTransactions(
    @Query("tenantId") tenantId: string,
    @Query("customerId", ParseUUIDPipe) customerId: string,
    @Query("limit") limit?: number,
    @Query("offset") offset?: number,
  ): Promise<{ data: PointsTransactionDetail[] }> {
    const data = await this.loyaltyService.getTransactionHistory(
      tenantId,
      customerId,
      limit ? Number(limit) : 20,
      offset ? Number(offset) : 0,
    );
    return { data };
  }

  @Post("redeem")
  async redeemPoints(
    @Query("tenantId") tenantId: string,
    @Query("customerId", ParseUUIDPipe) customerId: string,
    @Body() dto: RedeemPointsDto,
  ) {
    return this.loyaltyService.redeemPoints(
      tenantId,
      customerId,
      dto.points,
      dto.orderId,
    );
  }

  @Get("calculate")
  async calculateOrderPoints(
    @Query("tenantId") tenantId: string,
    @Query("customerId", ParseUUIDPipe) customerId: string,
    @Query("orderTotal") orderTotal: string,
  ): Promise<{ data: number }> {
    const data = await this.loyaltyService.calculateOrderPoints(
      tenantId,
      customerId,
      parseFloat(orderTotal),
    );
    return { data };
  }

  @Get("tiers")
  async getTiers(
    @Query("tenantId") tenantId: string,
  ): Promise<{ data: TierInfo[] }> {
    const data = await this.loyaltyService.getAvailableTiers(tenantId);
    return { data };
  }
}
