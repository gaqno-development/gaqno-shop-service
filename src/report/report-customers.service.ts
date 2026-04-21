import { Injectable } from "@nestjs/common";
import { and, count, eq, gte, lte, sql } from "drizzle-orm";
import { DrizzleService } from "../database/drizzle.service";
import { customers, orders } from "../database/schema";
import type {
  CustomerAcquisitionReport,
  CustomerReport,
} from "./report.types";

@Injectable()
export class ReportCustomersService {
  constructor(private readonly drizzle: DrizzleService) {}

  async getTopCustomers(
    tenantId: string,
    start: Date,
    end: Date,
    limit = 10,
  ): Promise<CustomerReport[]> {
    const rows = await this.drizzle.db
      .select({
        customerId: customers.id,
        firstName: customers.firstName,
        lastName: customers.lastName,
        email: customers.email,
        orders: count(orders.id),
        totalSpent: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
      })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .where(
        and(
          eq(orders.tenantId, tenantId),
          gte(orders.createdAt, start),
          lte(orders.createdAt, end),
          eq(orders.paymentStatus, "approved"),
        ),
      )
      .groupBy(customers.id, customers.firstName, customers.lastName, customers.email)
      .orderBy(sql`COALESCE(SUM(${orders.total}), 0) DESC`)
      .limit(limit);

    return rows.map((row) => ({
      customerId: row.customerId,
      customerName:
        [row.firstName, row.lastName].filter(Boolean).join(" ").trim() ||
        row.email,
      orders: Number(row.orders),
      totalSpent: Number(row.totalSpent),
    }));
  }

  async getAcquisition(
    tenantId: string,
    start: Date,
    end: Date,
  ): Promise<CustomerAcquisitionReport> {
    const newCustomersRow = await this.drizzle.db
      .select({ count: count() })
      .from(customers)
      .where(
        and(
          eq(customers.tenantId, tenantId),
          gte(customers.createdAt, start),
          lte(customers.createdAt, end),
        ),
      );

    const totalCustomersRow = await this.drizzle.db
      .select({ count: count() })
      .from(customers)
      .where(eq(customers.tenantId, tenantId));

    const returningRow = await this.drizzle.db
      .select({ count: sql<number>`COUNT(DISTINCT ${orders.customerId})` })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          sql`${orders.customerId} IN (
            SELECT customer_id FROM orders
            WHERE tenant_id = ${tenantId}
            GROUP BY customer_id
            HAVING COUNT(*) > 1
          )`,
        ),
      );

    return {
      newCustomers: Number(newCustomersRow[0]?.count ?? 0),
      returningCustomers: Number(returningRow[0]?.count ?? 0),
      totalCustomers: Number(totalCustomersRow[0]?.count ?? 0),
    };
  }
}
