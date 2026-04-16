import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import { AnalyticsService, DashboardStats, RevenueData, TopProduct, SalesByCategory } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  async getDashboard(
    @Query('tenantId') tenantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<{ data: DashboardStats }> {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    const stats = await this.analyticsService.getDashboardStats(tenantId, start, end);
    return { data: stats };
  }

  @Get('revenue')
  async getRevenue(
    @Query('tenantId') tenantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<{ data: RevenueData[] }> {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    const revenue = await this.analyticsService.getRevenueByDay(tenantId, start, end);
    return { data: revenue };
  }

  @Get('top-products')
  async getTopProducts(
    @Query('tenantId') tenantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('limit') limit?: string,
  ): Promise<{ data: TopProduct[] }> {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    const limitNum = limit ? parseInt(limit) : 10;
    
    const products = await this.analyticsService.getTopProducts(tenantId, start, end, limitNum);
    return { data: products };
  }

  @Get('sales-by-category')
  async getSalesByCategory(
    @Query('tenantId') tenantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<{ data: SalesByCategory[] }> {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    const sales = await this.analyticsService.getSalesByCategory(tenantId, start, end);
    return { data: sales };
  }

  @Get('hourly-sales')
  async getHourlySales(
    @Query('tenantId') tenantId: string,
    @Query('date') date: string,
  ): Promise<{ data: { hour: number; revenue: number; orders: number }[] }> {
    const queryDate = date ? new Date(date) : new Date();
    const hourly = await this.analyticsService.getHourlySales(tenantId, queryDate);
    return { data: hourly };
  }

  @Get('payment-methods')
  async getPaymentMethodStats(
    @Query('tenantId') tenantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<{ data: { method: string; count: number; total: number }[] }> {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    const stats = await this.analyticsService.getPaymentMethodStats(tenantId, start, end);
    return { data: stats };
  }
}