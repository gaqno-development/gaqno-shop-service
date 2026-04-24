import { Injectable } from "@nestjs/common";
import { and, count, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { DrizzleService } from "../database/drizzle.service";
import { customers, orders } from "../database/schema";
import {
  ANALYTICS_COUNTED_PAYMENT_STATUSES,
  DashboardStats,
  RevenueData,
} from "./analytics.types";

const STATIC_CONVERSION_RATE = 2.5;

@Injectable()
export class AnalyticsDashboardService {
  constructor(private readonly drizzle: DrizzleService) {}

  async getStats(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DashboardStats> {
    const db = this.drizzle.db;
    const orderStats = await db
      .select({
        total: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
        count: count(orders.id),
      })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          gte(orders.createdAt, startDate),
          lte(orders.createdAt, endDate),
          inArray(orders.paymentStatus, ANALYTICS_COUNTED_PAYMENT_STATUSES),
        ),
      )
      .groupBy(orders.tenantId);

    const customerCountRow = await db
      .select({ count: count() })
      .from(customers)
      .where(eq(customers.tenantId, tenantId));

    const totalOrders = orderStats[0]?.count ?? 0;
    const totalRevenue = Number(orderStats[0]?.total ?? 0);
    const totalCustomers = customerCountRow[0]?.count ?? 0;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const returningRow = await db
      .select({ count: count() })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          sql`${orders.customerId} IN (SELECT ${orders.customerId} FROM ${orders} WHERE ${orders.tenantId} = ${tenantId} GROUP BY ${orders.customerId} HAVING COUNT(*) > 1)`,
        ),
      );
    const returning = returningRow[0]?.count ?? 0;
    const repeatCustomerRate =
      totalCustomers > 0 ? (returning / totalCustomers) * 100 : 0;

    return {
      totalRevenue,
      totalOrders,
      totalCustomers,
      averageOrderValue,
      conversionRate: STATIC_CONVERSION_RATE,
      repeatCustomerRate,
    };
  }

  async getRevenueByDay(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<RevenueData[]> {
    const results = await this.drizzle.db
      .select({
        date: sql<string>`DATE(${orders.createdAt})`,
        revenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
        orders: count(orders.id),
      })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          gte(orders.createdAt, startDate),
          lte(orders.createdAt, endDate),
          inArray(orders.paymentStatus, ANALYTICS_COUNTED_PAYMENT_STATUSES),
        ),
      )
      .groupBy(sql`DATE(${orders.createdAt})`)
      .orderBy(sql`DATE(${orders.createdAt})`);

    return results.map((r) => ({
      date: r.date,
      revenue: Number(r.revenue),
      orders: Number(r.orders),
    }));
  }
}
