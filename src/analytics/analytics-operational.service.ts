import { Injectable } from "@nestjs/common";
import { and, count, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { DrizzleService } from "../database/drizzle.service";
import { orders } from "../database/schema";
import {
  ANALYTICS_COUNTED_PAYMENT_STATUSES,
  HourlySales,
  PaymentMethodStats,
} from "./analytics.types";

const HOURS_IN_DAY = 24;

@Injectable()
export class AnalyticsOperationalService {
  constructor(private readonly drizzle: DrizzleService) {}

  async getHourlySales(tenantId: string, date: Date): Promise<HourlySales[]> {
    const results = await this.drizzle.db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${orders.createdAt})`,
        revenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
        orders: count(orders.id),
      })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          sql`DATE(${orders.createdAt}) = DATE(${date})`,
          inArray(orders.paymentStatus, ANALYTICS_COUNTED_PAYMENT_STATUSES),
        ),
      )
      .groupBy(sql`EXTRACT(HOUR FROM ${orders.createdAt})`)
      .orderBy(sql`EXTRACT(HOUR FROM ${orders.createdAt})`);

    const map = new Map(
      results.map((r) => [
        Number(r.hour),
        { revenue: Number(r.revenue), orders: Number(r.orders) },
      ]),
    );

    return Array.from({ length: HOURS_IN_DAY }, (_, i) => ({
      hour: i,
      ...(map.get(i) ?? { revenue: 0, orders: 0 }),
    }));
  }

  async getPaymentMethodStats(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PaymentMethodStats[]> {
    const results = await this.drizzle.db
      .select({
        method: orders.paymentMethod,
        count: count(orders.id),
        total: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
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
      .groupBy(orders.paymentMethod);

    return results.map((r) => ({
      method: r.method ?? "unknown",
      count: Number(r.count),
      total: Number(r.total),
    }));
  }
}
