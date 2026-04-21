import { Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { DrizzleService } from "../database/drizzle.service";
import { orders } from "../database/schema";
import { ReportSalesService } from "./report-sales.service";
import { ReportCustomersService } from "./report-customers.service";
import { ReportInventoryService } from "./report-inventory.service";
import type {
  DashboardReport,
  EnhancedDashboardReport,
} from "./report.types";

const RECENT_ORDERS_LIMIT = 5;
const TOP_ITEMS_LIMIT = 5;

@Injectable()
export class ReportService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly sales: ReportSalesService,
    private readonly customersService: ReportCustomersService,
    private readonly inventory: ReportInventoryService,
  ) {}

  async getDashboard(
    tenantId: string,
    start: Date,
    end: Date,
  ): Promise<DashboardReport> {
    const [salesByDay, topProducts, recentOrders, acquisition] =
      await Promise.all([
        this.sales.getSalesByDay(tenantId, start, end),
        this.sales.getTopProducts(tenantId, start, end, TOP_ITEMS_LIMIT),
        this.getRecentOrders(tenantId),
        this.customersService.getAcquisition(tenantId, start, end),
      ]);

    const totalRevenue = salesByDay.reduce((acc, day) => acc + day.revenue, 0);
    const totalOrders = salesByDay.reduce((acc, day) => acc + day.orders, 0);
    const averageOrderValue =
      totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      totalRevenue,
      totalOrders,
      totalCustomers: acquisition.totalCustomers,
      averageOrderValue,
      recentOrders,
      topProducts,
    };
  }

  async getEnhancedDashboard(
    tenantId: string,
    start: Date,
    end: Date,
  ): Promise<EnhancedDashboardReport> {
    const [base, hourlySales, orderStatusDistribution, topCategories, inventoryAlerts, customerAcquisition] =
      await Promise.all([
        this.getDashboard(tenantId, start, end),
        this.sales.getHourlySales(tenantId, start, end),
        this.sales.getOrderStatusDistribution(tenantId),
        this.sales.getCategoryRevenue(tenantId, start, end),
        this.inventory.getAlerts(tenantId),
        this.customersService.getAcquisition(tenantId, start, end),
      ]);

    return {
      ...base,
      hourlySales,
      orderStatusDistribution,
      topCategories: topCategories.slice(0, TOP_ITEMS_LIMIT),
      inventoryAlerts,
      customerAcquisition,
    };
  }

  private getRecentOrders(tenantId: string) {
    return this.drizzle.db.query.orders.findMany({
      where: eq(orders.tenantId, tenantId),
      orderBy: [desc(orders.createdAt)],
      limit: RECENT_ORDERS_LIMIT,
    });
  }
}
