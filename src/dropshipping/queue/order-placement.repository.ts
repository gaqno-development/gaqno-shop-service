import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { SupplierOrderResult } from "@gaqno-development/types";
import type { ShopDatabase } from "../../database/shop-database.type";
import { orders } from "../../database/schema/order";
import type {
  DropshippingOrderSnapshot,
  OrderPlacementRepositoryPort,
} from "./order-placement.types";

@Injectable()
export class OrderPlacementRepository implements OrderPlacementRepositoryPort {
  constructor(@Inject("DATABASE") private readonly db: ShopDatabase) {}

  async findSnapshot(
    orderId: string,
    tenantId: string,
  ): Promise<DropshippingOrderSnapshot | undefined> {
    const rows = await this.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)))
      .limit(1);
    const row = rows[0];
    if (!row) return undefined;
    return this.toSnapshot(row);
  }

  async markPlacing(orderId: string, tenantId: string): Promise<void> {
    await this.db
      .update(orders)
      .set({ fulfillmentStatus: "placing", updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)));
  }

  async markPlaced(
    orderId: string,
    tenantId: string,
    result: SupplierOrderResult,
  ): Promise<void> {
    await this.db
      .update(orders)
      .set({
        fulfillmentStatus: "placed",
        supplierOrderId: result.externalOrderId,
        onHoldReason: null,
        updatedAt: new Date(),
      })
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)));
  }

  async markOnHold(
    orderId: string,
    tenantId: string,
    reason: string,
  ): Promise<void> {
    await this.db
      .update(orders)
      .set({
        fulfillmentStatus: "on_hold",
        onHoldReason: reason,
        updatedAt: new Date(),
      })
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)));
  }

  private toSnapshot(row: typeof orders.$inferSelect): DropshippingOrderSnapshot {
    const address = row.shippingAddress as DropshippingOrderSnapshot["shippingAddress"];
    const metadata = (row.metadata ?? {}) as Record<string, string>;
    return {
      orderId: row.id,
      tenantId: row.tenantId,
      providerCode: row.supplierProviderCode ?? "aliexpress",
      externalProductId: metadata.externalProductId ?? "",
      externalVariationId: metadata.externalVariationId,
      quantity: Number(metadata.quantity ?? 1),
      buyerTaxNumber: metadata.buyerTaxNumber ?? "",
      shippingAddress: address,
      referenceId: row.orderNumber,
      fulfillmentStatus:
        (row.fulfillmentStatus as DropshippingOrderSnapshot["fulfillmentStatus"]) ??
        "pending",
    };
  }
}
