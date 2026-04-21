import { Injectable } from "@nestjs/common";
import { and, count, eq, gte, lte, sql } from "drizzle-orm";
import { DrizzleService } from "../database/drizzle.service";
import { categories, orderItems, orders, products } from "../database/schema";
import type {
  CategoryRevenueReport,
  HourlySalesReport,
  OrderStatusDistribution,
  ProductReport,
  SalesReport,
} from "./report.types";

@Injectable()
export class ReportSalesService {
  constructor(private readonly drizzle: DrizzleService) {}

  async getSalesByDay(
    tenantId: string,
    start: Date,
    end: Date,
  ): Promise<SalesReport[]> {
    const rows = await this.drizzle.db
      .select({
        date: sql<string>`DATE(${orders.createdAt})`,
        revenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
        orders: count(orders.id),
      })
      .from(orders)
      .where(this.paidWhere(tenantId, start, end))
      .groupBy(sql`DATE(${orders.createdAt})`)
      .orderBy(sql`DATE(${orders.createdAt})`);

    return rows.map((row) => {
      const revenue = Number(row.revenue);
      const count = Number(row.orders);
      return {
        date: row.date,
        orders: count,
        revenue,
        averageOrderValue: count > 0 ? revenue / count : 0,
      };
    });
  }

  async getTopProducts(
    tenantId: string,
    start: Date,
    end: Date,
    limit = 10,
  ): Promise<ProductReport[]> {
    const rows = await this.drizzle.db
      .select({
        productId: orderItems.productId,
        productName: orderItems.name,
        unitsSold: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)`,
        revenue: sql<number>`COALESCE(SUM(${orderItems.total}), 0)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(this.paidWhere(tenantId, start, end))
      .groupBy(orderItems.productId, orderItems.name)
      .orderBy(sql`COALESCE(SUM(${orderItems.total}), 0) DESC`)
      .limit(limit);

    return rows.map((row) => ({
      productId: row.productId ?? "",
      productName: row.productName,
      unitsSold: Number(row.unitsSold),
      revenue: Number(row.revenue),
    }));
  }

  async getHourlySales(
    tenantId: string,
    start: Date,
    end: Date,
  ): Promise<HourlySalesReport[]> {
    const rows = await this.drizzle.db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${orders.createdAt})::int`,
        revenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
        orders: count(orders.id),
      })
      .from(orders)
      .where(this.paidWhere(tenantId, start, end))
      .groupBy(sql`EXTRACT(HOUR FROM ${orders.createdAt})`)
      .orderBy(sql`EXTRACT(HOUR FROM ${orders.createdAt})`);

    return rows.map((row) => ({
      hour: Number(row.hour),
      revenue: Number(row.revenue),
      orders: Number(row.orders),
    }));
  }

  async getOrderStatusDistribution(
    tenantId: string,
  ): Promise<OrderStatusDistribution[]> {
    const rows = await this.drizzle.db
      .select({ status: orders.status, count: count(orders.id) })
      .from(orders)
      .where(eq(orders.tenantId, tenantId))
      .groupBy(orders.status);

    const total = rows.reduce((acc, row) => acc + Number(row.count), 0);
    return rows.map((row) => ({
      status: row.status ?? "unknown",
      count: Number(row.count),
      percentage: total > 0 ? (Number(row.count) / total) * 100 : 0,
    }));
  }

  async getCategoryRevenue(
    tenantId: string,
    start: Date,
    end: Date,
  ): Promise<CategoryRevenueReport[]> {
    const rows = await this.drizzle.db
      .select({
        categoryId: categories.id,
        categoryName: categories.name,
        revenue: sql<number>`COALESCE(SUM(${orderItems.total}), 0)`,
        orders: sql<number>`COUNT(DISTINCT ${orders.id})`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(products, eq(products.id, orderItems.productId))
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .where(this.paidWhere(tenantId, start, end))
      .groupBy(categories.id, categories.name);

    const total = rows.reduce((acc, row) => acc + Number(row.revenue), 0);
    return rows.map((row) => ({
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      revenue: Number(row.revenue),
      orders: Number(row.orders),
      percentage: total > 0 ? (Number(row.revenue) / total) * 100 : 0,
    }));
  }

  private paidWhere(tenantId: string, start: Date, end: Date) {
    return and(
      eq(orders.tenantId, tenantId),
      gte(orders.createdAt, start),
      lte(orders.createdAt, end),
      eq(orders.paymentStatus, "approved"),
    );
  }
}
