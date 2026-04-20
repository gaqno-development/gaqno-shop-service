import { Injectable } from "@nestjs/common";
import { AnalyticsDashboardService } from "./analytics-dashboard.service";
import { AnalyticsProductsService } from "./analytics-products.service";
import { AnalyticsOperationalService } from "./analytics-operational.service";
import {
  DashboardStats,
  HourlySales,
  PaymentMethodStats,
  RevenueData,
  SalesByCategory,
  TopProduct,
} from "./analytics.types";

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly dashboardService: AnalyticsDashboardService,
    private readonly productsService: AnalyticsProductsService,
    private readonly operationalService: AnalyticsOperationalService,
  ) {}

  getDashboardStats(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DashboardStats> {
    return this.dashboardService.getStats(tenantId, startDate, endDate);
  }

  getRevenueByDay(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<RevenueData[]> {
    return this.dashboardService.getRevenueByDay(tenantId, startDate, endDate);
  }

  getTopProducts(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    limit?: number,
  ): Promise<TopProduct[]> {
    return this.productsService.getTopProducts(
      tenantId,
      startDate,
      endDate,
      limit,
    );
  }

  getSalesByCategory(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<SalesByCategory[]> {
    return this.productsService.getSalesByCategory(tenantId, startDate, endDate);
  }

  getHourlySales(tenantId: string, date: Date): Promise<HourlySales[]> {
    return this.operationalService.getHourlySales(tenantId, date);
  }

  getPaymentMethodStats(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PaymentMethodStats[]> {
    return this.operationalService.getPaymentMethodStats(
      tenantId,
      startDate,
      endDate,
    );
  }
}
