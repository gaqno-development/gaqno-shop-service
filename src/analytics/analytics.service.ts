import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../database/drizzle.service';
import { orders, orderItems, products, customers, customerPoints } from '../database/schema';
import { eq, and, gte, lte, desc, sql, count } from 'drizzle-orm';

export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  averageOrderValue: number;
  conversionRate: number;
  repeatCustomerRate: number;
}

export interface RevenueData {
  date: string;
  revenue: number;
  orders: number;
}

export interface TopProduct {
  id: string;
  name: string;
  revenue: number;
  quantity: number;
}

export interface SalesByCategory {
  categoryId: string;
  categoryName: string;
  revenue: number;
  percentage: number;
}

export interface CustomerMetrics {
  newCustomers: number;
  returningCustomers: number;
  averageLTV: number;
  churnRate: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly drizzle: DrizzleService) {}

  async getDashboardStats(tenantId: string, startDate: Date, endDate: Date): Promise<DashboardStats> {
    const db = this.drizzle.db;

    const orderStats = await db.select({
      total: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
      count: count(orders.id),
    }).from(orders).where(
      and(
        eq(orders.tenantId, tenantId),
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate),
        eq(orders.paymentStatus, 'approved')
      )
    ).groupBy(orders.tenantId);

    const customerCount = await db.select({ count: count() })
      .from(customers)
      .where(eq(customers.tenantId, tenantId));

    const avgOrderValue = orderStats[0]?.count > 0 
      ? orderStats[0].total / orderStats[0].count 
      : 0;

    const conversionRate = 2.5;

    const returningCustomers = await db
      .select({ count: count() })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          sql`${orders.customerId} IN (SELECT ${orders.customerId} FROM ${orders} WHERE ${orders.tenantId} = ${tenantId} GROUP BY ${orders.customerId} HAVING COUNT(*) > 1)`
        )
      );

    const repeatRate = customerCount[0]?.count > 0 
      ? (returningCustomers[0]?.count || 0) / customerCount[0]?.count 
      : 0;

    return {
      totalRevenue: orderStats[0]?.total || 0,
      totalOrders: orderStats[0]?.count || 0,
      totalCustomers: customerCount[0]?.count || 0,
      averageOrderValue: avgOrderValue,
      conversionRate,
      repeatCustomerRate: repeatRate * 100,
    };
  }

  async getRevenueByDay(tenantId: string, startDate: Date, endDate: Date): Promise<RevenueData[]> {
    const db = this.drizzle.db;

    const results = await db.select({
      date: sql<string>`DATE(${orders.createdAt})`,
      revenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
      orders: count(orders.id),
    }).from(orders).where(
      and(
        eq(orders.tenantId, tenantId),
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate),
        eq(orders.paymentStatus, 'approved')
      )
    ).groupBy(sql`DATE(${orders.createdAt})`).orderBy(sql`DATE(${orders.createdAt})`);

    return results.map(r => ({
      date: r.date,
      revenue: Number(r.revenue),
      orders: Number(r.orders),
    }));
  }

  async getTopProducts(tenantId: string, startDate: Date, endDate: Date, limit = 10): Promise<TopProduct[]> {
    const db = this.drizzle.db;

    const results = await db.select({
      id: orderItems.productId,
      name: sql<string>`MAX(${orderItems.name})`,
      revenue: sql<number>`SUM(${orderItems.total})`,
      quantity: sql<number>`SUM(${orderItems.quantity})`,
    }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).where(
      and(
        eq(orders.tenantId, tenantId),
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate),
        eq(orders.paymentStatus, 'approved')
      )
    ).groupBy(orderItems.productId).orderBy(sql`SUM(${orderItems.total}) DESC`).limit(limit);

    return results.map(r => ({
      id: r.id,
      name: r.name || 'Produto',
      revenue: Number(r.revenue),
      quantity: Number(r.quantity),
    }));
  }

  async getSalesByCategory(tenantId: string, startDate: Date, endDate: Date): Promise<SalesByCategory[]> {
    const db = this.drizzle.db;

    const results = await db.select({
      categoryId: products.categoryId,
      categoryName: sql<string>`MAX(${products.categoryId})`,
      revenue: sql<number>`COALESCE(SUM(${orderItems.total}), 0)`,
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(
        and(
          eq(orders.tenantId, tenantId),
          gte(orders.createdAt, startDate),
          lte(orders.createdAt, endDate),
          eq(orders.paymentStatus, 'approved')
        )
      )
      .groupBy(products.categoryId)
      .orderBy(sql`COALESCE(SUM(${orderItems.total}), 0) DESC`);

    const totalRevenue = results.reduce((sum, r) => sum + Number(r.revenue), 0);

    return results.map(r => ({
      categoryId: r.categoryId || 'unknown',
      categoryName: r.categoryName || 'Sem categoria',
      revenue: Number(r.revenue),
      percentage: totalRevenue > 0 ? (Number(r.revenue) / totalRevenue) * 100 : 0,
    }));
  }

  async getHourlySales(tenantId: string, date: Date): Promise<{ hour: number; revenue: number; orders: number }[]> {
    const db = this.drizzle.db;

    const results = await db.select({
      hour: sql<number>`EXTRACT(HOUR FROM ${orders.createdAt})`,
      revenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
      orders: count(orders.id),
    }).from(orders).where(
      and(
        eq(orders.tenantId, tenantId),
        sql`DATE(${orders.createdAt}) = DATE(${date})`,
        eq(orders.paymentStatus, 'approved')
      )
    ).groupBy(sql`EXTRACT(HOUR FROM ${orders.createdAt})`).orderBy(sql`EXTRACT(HOUR FROM ${orders.createdAt})`);

    const hourlyMap = new Map(results.map(r => [Number(r.hour), { revenue: Number(r.revenue), orders: Number(r.orders) }]));

    return Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      ...(hourlyMap.get(i) || { revenue: 0, orders: 0 }),
    }));
  }

  async getPaymentMethodStats(tenantId: string, startDate: Date, endDate: Date): Promise<{ method: string; count: number; total: number }[]> {
    const db = this.drizzle.db;

    const results = await db.select({
      method: orders.paymentMethod,
      count: count(orders.id),
      total: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
    }).from(orders).where(
      and(
        eq(orders.tenantId, tenantId),
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate),
        eq(orders.paymentStatus, 'approved')
      )
    ).groupBy(orders.paymentMethod);

    return results.map(r => ({
      method: r.method || 'unknown',
      count: Number(r.count),
      total: Number(r.total),
    }));
  }
}