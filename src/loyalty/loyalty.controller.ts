import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { DrizzleService } from '../database/drizzle.service';
import { LoyaltyService, PointsSummary, PointsTransactionDetail, TierInfo } from './loyalty.service';
import { customerPoints, customerTierRules, pointsTransactions } from '../database/schema';
import { eq, and, desc } from 'drizzle-orm';
import { IsNumber, IsOptional, IsString } from 'class-validator';

class RedeemPointsDto {
  @IsNumber()
  points: number;

  @IsOptional()
  @IsString()
  orderId?: string;
}

class CreateTierRuleDto {
  @IsString()
  tier: string;

  @IsNumber()
  minPoints: number;

  @IsOptional()
  @IsNumber()
  pointsMultiplier?: number;
}

@Controller('loyalty')
export class LoyaltyController {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  @Get('summary')
  async getPointsSummary(
    @Query('tenantId') tenantId: string,
    @Query('customerId', ParseUUIDPipe) customerId: string,
  ): Promise<{ data: PointsSummary }> {
    const summary = await this.loyaltyService.getPointsSummary(tenantId, customerId);
    return { data: summary };
  }

  @Get('transactions')
  async getTransactions(
    @Query('tenantId') tenantId: string,
    @Query('customerId', ParseUUIDPipe) customerId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<{ data: PointsTransactionDetail[] }> {
    const transactions = await this.loyaltyService.getTransactionHistory(
      tenantId,
      customerId,
      limit ? parseInt(limit.toString()) : 20,
      offset ? parseInt(offset.toString()) : 0,
    );
    return { data: transactions };
  }

  @Post('redeem')
  async redeemPoints(
    @Query('tenantId') tenantId: string,
    @Query('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: RedeemPointsDto,
  ) {
    const result = await this.loyaltyService.redeemPoints(
      tenantId,
      customerId,
      dto.points,
      dto.orderId,
    );
    return result;
  }

  @Get('calculate')
  async calculateOrderPoints(
    @Query('tenantId') tenantId: string,
    @Query('customerId', ParseUUIDPipe) customerId: string,
    @Query('orderTotal') orderTotal: string,
  ): Promise<{ data: number }> {
    const points = await this.loyaltyService.calculateOrderPoints(
      tenantId,
      customerId,
      parseFloat(orderTotal),
    );
    return { data: points };
  }

  @Get('tiers')
  async getTiers(@Query('tenantId') tenantId: string): Promise<{ data: TierInfo[] }> {
    const tiers = await this.loyaltyService.getAvailableTiers(tenantId);
    return { data: tiers };
  }

  // Admin endpoints
  @Get('admin/points')
  async getAllCustomerPoints(
    @Query('tenantId') tenantId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const db = this.drizzle.db;
    const pageNum = page ? parseInt(page.toString()) : 1;
    const limitNum = limit ? parseInt(limit.toString()) : 20;
    const offset = (pageNum - 1) * limitNum;

    const pointsData = await db.query.customerPoints.findMany({
      where: eq(customerPoints.tenantId, tenantId),
      orderBy: [desc(customerPoints.balance)],
      limit: limitNum,
      offset,
      with: {
        customer: true,
      },
    });

    return { data: pointsData };
  }

  @Get('admin/tier-rules')
  async getTierRules(@Query('tenantId') tenantId: string) {
    const rules = await this.drizzle.db.query.customerTierRules.findMany({
      where: eq(customerTierRules.tenantId, tenantId),
      orderBy: [desc(customerTierRules.minPoints)],
    });
    return { data: rules };
  }

  @Post('admin/tier-rules')
  async createTierRule(
    @Query('tenantId') tenantId: string,
    @Body() dto: CreateTierRuleDto,
  ) {
    const [rule] = await this.drizzle.db
      .insert(customerTierRules)
      .values({
        tenantId,
        tier: dto.tier,
        minPoints: dto.minPoints,
        pointsMultiplier: dto.pointsMultiplier?.toString() || "1.00",
      })
      .returning();

    return { data: rule };
  }

  @Post('admin/tier-rules/:id')
  async updateTierRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('tenantId') tenantId: string,
    @Body() dto: Partial<CreateTierRuleDto>,
  ) {
    const updateData: Record<string, any> = { ...dto };
    if (updateData.pointsMultiplier !== undefined) {
      updateData.pointsMultiplier = updateData.pointsMultiplier?.toString() || "1.00";
    }

    const [updated] = await this.drizzle.db
      .update(customerTierRules)
      .set({ ...updateData, updatedAt: new Date() })
      .where(
        and(
          eq(customerTierRules.id, id),
          eq(customerTierRules.tenantId, tenantId)
        )
      )
      .returning();

    return { data: updated };
  }

  @Post('admin/adjust-points')
  async adjustPoints(
    @Query('tenantId') tenantId: string,
    @Query('customerId', ParseUUIDPipe) customerId: string,
    @Body() body: { amount: number; description: string },
  ) {
    const points = await this.loyaltyService.getOrCreatePoints(tenantId, customerId);
    const newBalance = points.balance + body.amount;
    
    if (newBalance < 0) {
      return { success: false, message: 'Saldo não pode ser negativo' };
    }

    await this.drizzle.db.transaction(async (tx) => {
      if (body.amount > 0) {
        await tx.update(customerPoints).set({
          balance: newBalance,
          lifetimeEarned: points.lifetimeEarned + body.amount,
        }).where(eq(customerPoints.id, points.id));
      } else {
        await tx.update(customerPoints).set({
          balance: newBalance,
          lifetimeRedeemed: points.lifetimeRedeemed + Math.abs(body.amount),
        }).where(eq(customerPoints.id, points.id));
      }

      await tx.insert(pointsTransactions).values({
        tenantId,
        customerId,
        type: body.amount > 0 ? 'bonus' : 'adjustment',
        amount: body.amount,
        description: body.description,
      });
    });

    return { success: true, newBalance };
  }
}