import { Injectable } from "@nestjs/common";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { DrizzleService } from "../database/drizzle.service";
import { orderItems, orders, products } from "../database/schema";
import { SalesByCategory, TopProduct } from "./analytics.types";

@Injectable()
export class AnalyticsProductsService {
  constructor(private readonly drizzle: DrizzleService) {}

  async getTopProducts(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    limit = 10,
  ): Promise<TopProduct[]> {
    const results = await this.drizzle.db
      .select({
        id: orderItems.productId,
        name: sql<string>`MAX(${orderItems.name})`,
        revenue: sql<number>`SUM(${orderItems.total})`,
        quantity: sql<number>`SUM(${orderItems.quantity})`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(
        and(
          eq(orders.tenantId, tenantId),
          gte(orders.createdAt, startDate),
          lte(orders.createdAt, endDate),
          eq(orders.paymentStatus, "approved"),
        ),
      )
      .groupBy(orderItems.productId)
      .orderBy(sql`SUM(${orderItems.total}) DESC`)
      .limit(limit);

    return results.map((r) => ({
      id: r.id ?? "",
      name: r.name || "Produto",
      revenue: Number(r.revenue),
      quantity: Number(r.quantity),
    }));
  }

  async getSalesByCategory(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<SalesByCategory[]> {
    const results = await this.drizzle.db
      .select({
        categoryId: products.categoryId,
        categoryName: sql<string>`MAX(${products.categoryId})`,
        revenue: sql<number>`COALESCE(SUM(${orderItems.total}), 0)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(
        and(
          eq(orders.tenantId, tenantId),
          gte(orders.createdAt, startDate),
          lte(orders.createdAt, endDate),
          eq(orders.paymentStatus, "approved"),
        ),
      )
      .groupBy(products.categoryId)
      .orderBy(sql`COALESCE(SUM(${orderItems.total}), 0) DESC`);

    const totalRevenue = results.reduce(
      (sum, r) => sum + Number(r.revenue),
      0,
    );

    return results.map((r) => ({
      categoryId: r.categoryId ?? "unknown",
      categoryName: r.categoryName || "Sem categoria",
      revenue: Number(r.revenue),
      percentage:
        totalRevenue > 0 ? (Number(r.revenue) / totalRevenue) * 100 : 0,
    }));
  }
}
