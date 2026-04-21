import { Injectable } from "@nestjs/common";
import { and, eq, lte } from "drizzle-orm";
import { DrizzleService } from "../database/drizzle.service";
import { products } from "../database/schema";
import {
  CRITICAL_STOCK_THRESHOLD,
  LOW_STOCK_THRESHOLD,
} from "./report.constants";
import type { InventoryAlert, InventorySeverity } from "./report.types";

function resolveSeverity(stock: number): InventorySeverity {
  return stock <= CRITICAL_STOCK_THRESHOLD ? "critical" : "low";
}

@Injectable()
export class ReportInventoryService {
  constructor(private readonly drizzle: DrizzleService) {}

  async getAlerts(tenantId: string): Promise<InventoryAlert[]> {
    const rows = await this.drizzle.db
      .select({
        id: products.id,
        name: products.name,
        quantity: products.inventoryQuantity,
      })
      .from(products)
      .where(
        and(
          eq(products.tenantId, tenantId),
          eq(products.inventoryTracked, true),
          lte(products.inventoryQuantity, LOW_STOCK_THRESHOLD),
        ),
      );

    return rows.map((row) => {
      const stock = Number(row.quantity ?? 0);
      return {
        productId: row.id,
        productName: row.name,
        currentStock: stock,
        threshold: LOW_STOCK_THRESHOLD,
        severity: resolveSeverity(stock),
      };
    });
  }
}
