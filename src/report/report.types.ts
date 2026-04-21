import type { Order } from "../database/schema";

export interface SalesReport {
  readonly date: string;
  readonly orders: number;
  readonly revenue: number;
  readonly averageOrderValue: number;
}

export interface ProductReport {
  readonly productId: string;
  readonly productName: string;
  readonly unitsSold: number;
  readonly revenue: number;
}

export interface CustomerReport {
  readonly customerId: string;
  readonly customerName: string;
  readonly orders: number;
  readonly totalSpent: number;
}

export interface HourlySalesReport {
  readonly hour: number;
  readonly revenue: number;
  readonly orders: number;
}

export interface OrderStatusDistribution {
  readonly status: string;
  readonly count: number;
  readonly percentage: number;
}

export interface CustomerAcquisitionReport {
  readonly newCustomers: number;
  readonly returningCustomers: number;
  readonly totalCustomers: number;
}

export interface CategoryRevenueReport {
  readonly categoryId: string;
  readonly categoryName: string;
  readonly revenue: number;
  readonly orders: number;
  readonly percentage: number;
}

export type InventorySeverity = "low" | "critical";

export interface InventoryAlert {
  readonly productId: string;
  readonly productName: string;
  readonly currentStock: number;
  readonly threshold: number;
  readonly severity: InventorySeverity;
}

export interface DashboardReport {
  readonly totalRevenue: number;
  readonly totalOrders: number;
  readonly totalCustomers: number;
  readonly averageOrderValue: number;
  readonly recentOrders: Order[];
  readonly topProducts: ProductReport[];
}

export interface EnhancedDashboardReport extends DashboardReport {
  readonly hourlySales: HourlySalesReport[];
  readonly orderStatusDistribution: OrderStatusDistribution[];
  readonly customerAcquisition: CustomerAcquisitionReport;
  readonly topCategories: CategoryRevenueReport[];
  readonly inventoryAlerts: InventoryAlert[];
}
