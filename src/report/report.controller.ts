import { Controller, Get, Query } from "@nestjs/common";
import { CurrentTenant } from "../common/decorators/current-tenant.decorator";
import { TenantContext } from "../common/tenant-context";
import { ReportService } from "./report.service";
import { ReportSalesService } from "./report-sales.service";
import { ReportCustomersService } from "./report-customers.service";
import { ReportInventoryService } from "./report-inventory.service";
import { parseDateRange } from "./report.constants";

@Controller("reports")
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly sales: ReportSalesService,
    private readonly customersService: ReportCustomersService,
    private readonly inventory: ReportInventoryService,
  ) {}

  @Get("dashboard")
  async dashboard(@CurrentTenant() tenant: TenantContext) {
    if (!tenant) return this.emptyDashboard();
    const { start, end } = parseDateRange();
    return this.reportService.getDashboard(tenant.tenantId, start, end);
  }

  @Get("dashboard/enhanced")
  async enhancedDashboard(@CurrentTenant() tenant: TenantContext) {
    if (!tenant) return this.emptyEnhancedDashboard();
    const { start, end } = parseDateRange();
    return this.reportService.getEnhancedDashboard(tenant.tenantId, start, end);
  }

  @Get("sales")
  async sales_(
    @CurrentTenant() tenant: TenantContext,
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
  ) {
    if (!tenant) return [];
    const { start, end } = parseDateRange(startDate, endDate);
    return this.sales.getSalesByDay(tenant.tenantId, start, end);
  }

  @Get("products")
  async products(
    @CurrentTenant() tenant: TenantContext,
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
    @Query("limit") limit?: string,
  ) {
    if (!tenant) return [];
    const { start, end } = parseDateRange(startDate, endDate);
    return this.sales.getTopProducts(
      tenant.tenantId,
      start,
      end,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get("customers")
  async customers(
    @CurrentTenant() tenant: TenantContext,
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
    @Query("limit") limit?: string,
  ) {
    if (!tenant) return [];
    const { start, end } = parseDateRange(startDate, endDate);
    return this.customersService.getTopCustomers(
      tenant.tenantId,
      start,
      end,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get("hourly-sales")
  async hourlySales(
    @CurrentTenant() tenant: TenantContext,
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
  ) {
    if (!tenant) return [];
    const { start, end } = parseDateRange(startDate, endDate);
    return this.sales.getHourlySales(tenant.tenantId, start, end);
  }

  @Get("order-status-distribution")
  async orderStatusDistribution(@CurrentTenant() tenant: TenantContext) {
    if (!tenant) return [];
    return this.sales.getOrderStatusDistribution(tenant.tenantId);
  }

  @Get("customer-acquisition")
  async customerAcquisition(
    @CurrentTenant() tenant: TenantContext,
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
  ) {
    if (!tenant) {
      return { newCustomers: 0, returningCustomers: 0, totalCustomers: 0 };
    }
    const { start, end } = parseDateRange(startDate, endDate);
    return this.customersService.getAcquisition(tenant.tenantId, start, end);
  }

  @Get("category-revenue")
  async categoryRevenue(
    @CurrentTenant() tenant: TenantContext,
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
  ) {
    if (!tenant) return [];
    const { start, end } = parseDateRange(startDate, endDate);
    return this.sales.getCategoryRevenue(tenant.tenantId, start, end);
  }

  @Get("inventory-alerts")
  async inventoryAlerts(@CurrentTenant() tenant: TenantContext) {
    if (!tenant) return [];
    return this.inventory.getAlerts(tenant.tenantId);
  }

  private emptyDashboard() {
    return {
      totalRevenue: 0,
      totalOrders: 0,
      totalCustomers: 0,
      averageOrderValue: 0,
      recentOrders: [],
      topProducts: [],
    };
  }

  private emptyEnhancedDashboard() {
    return {
      ...this.emptyDashboard(),
      hourlySales: [],
      orderStatusDistribution: [],
      topCategories: [],
      inventoryAlerts: [],
      customerAcquisition: {
        newCustomers: 0,
        returningCustomers: 0,
        totalCustomers: 0,
      },
    };
  }
}
