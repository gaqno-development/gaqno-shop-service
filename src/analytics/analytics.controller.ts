import { Controller, Get, Query } from "@nestjs/common";
import { CurrentTenant } from "../common/decorators/current-tenant.decorator";
import { requireTenantId } from "../common/tenant-guard";
import { AnalyticsService } from "./analytics.service";
import {
  DashboardStats,
  RevenueData,
  SalesByCategory,
  TopProduct,
} from "./analytics.types";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_TOP_PRODUCTS_LIMIT = 10;

function resolveRange(start?: string, end?: string): { start: Date; end: Date } {
  return {
    start: start ? new Date(start) : new Date(Date.now() - THIRTY_DAYS_MS),
    end: end ? new Date(end) : new Date(),
  };
}

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("dashboard")
  async getDashboard(
    @CurrentTenant("tenantId") tenantId: string | undefined,
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
  ): Promise<{ data: DashboardStats }> {
    const { start, end } = resolveRange(startDate, endDate);
    const stats = await this.analyticsService.getDashboardStats(
      requireTenantId(tenantId),
      start,
      end,
    );
    return { data: stats };
  }

  @Get("revenue")
  async getRevenue(
    @CurrentTenant("tenantId") tenantId: string | undefined,
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
  ): Promise<{ data: RevenueData[] }> {
    const { start, end } = resolveRange(startDate, endDate);
    const revenue = await this.analyticsService.getRevenueByDay(
      requireTenantId(tenantId),
      start,
      end,
    );
    return { data: revenue };
  }

  @Get("top-products")
  async getTopProducts(
    @CurrentTenant("tenantId") tenantId: string | undefined,
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
    @Query("limit") limit?: string,
  ): Promise<{ data: TopProduct[] }> {
    const { start, end } = resolveRange(startDate, endDate);
    const limitNum = limit ? parseInt(limit, 10) : DEFAULT_TOP_PRODUCTS_LIMIT;
    const products = await this.analyticsService.getTopProducts(
      requireTenantId(tenantId),
      start,
      end,
      limitNum,
    );
    return { data: products };
  }

  @Get("sales-by-category")
  async getSalesByCategory(
    @CurrentTenant("tenantId") tenantId: string | undefined,
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
  ): Promise<{ data: SalesByCategory[] }> {
    const { start, end } = resolveRange(startDate, endDate);
    const sales = await this.analyticsService.getSalesByCategory(
      requireTenantId(tenantId),
      start,
      end,
    );
    return { data: sales };
  }

  @Get("hourly-sales")
  async getHourlySales(
    @CurrentTenant("tenantId") tenantId: string | undefined,
    @Query("date") date: string,
  ): Promise<{ data: { hour: number; revenue: number; orders: number }[] }> {
    const queryDate = date ? new Date(date) : new Date();
    const hourly = await this.analyticsService.getHourlySales(
      requireTenantId(tenantId),
      queryDate,
    );
    return { data: hourly };
  }

  @Get("payment-methods")
  async getPaymentMethodStats(
    @CurrentTenant("tenantId") tenantId: string | undefined,
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
  ): Promise<{ data: { method: string; count: number; total: number }[] }> {
    const { start, end } = resolveRange(startDate, endDate);
    const stats = await this.analyticsService.getPaymentMethodStats(
      requireTenantId(tenantId),
      start,
      end,
    );
    return { data: stats };
  }
}
