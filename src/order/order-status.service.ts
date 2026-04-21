import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { orderItems, orders, orderStatusHistory } from "../database/schema";
import { ShopDatabase } from "../database/shop-database.type";
import { EventsService } from "../events/events.service";
import { BakeryOrderLifecycleService } from "../bakery/order-lifecycle/bakery-order-lifecycle.service";
import type { BakeryOrderStatus } from "../bakery/order-lifecycle/status-transitions";
import { UpdateOrderStatusDto } from "./dto/order.dto";
import { OrderReadService } from "./order-read.service";

const ORDER_STATUSES: readonly BakeryOrderStatus[] = [
  "pending",
  "confirmed",
  "awaiting_decoration_review",
  "decoration_approved",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

function isOrderStatus(value: string): value is BakeryOrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

@Injectable()
export class OrderStatusService {
  constructor(
    @Inject("DATABASE") private readonly db: ShopDatabase,
    private readonly reader: OrderReadService,
    private readonly events: EventsService,
    private readonly lifecycle: BakeryOrderLifecycleService,
  ) {}

  async updateStatus(
    tenantId: string,
    orderNumber: string,
    dto: UpdateOrderStatusDto,
  ) {
    if (!isOrderStatus(dto.status)) {
      throw new BadRequestException(`Invalid order status: ${dto.status}`);
    }
    const order = await this.reader.findOne(tenantId, orderNumber);
    const previous = (order.status ?? "pending") as BakeryOrderStatus;
    this.lifecycle.assertTransition(previous, dto.status);

    await this.db
      .update(orders)
      .set({ status: dto.status, updatedAt: new Date() })
      .where(and(eq(orders.tenantId, tenantId), eq(orders.id, order.id)));

    await this.db.insert(orderStatusHistory).values({
      tenantId,
      orderId: order.id,
      status: dto.status,
      notes: dto.notes,
    });

    const items = await this.db.query.orderItems.findMany({
      where: and(
        eq(orderItems.tenantId, tenantId),
        eq(orderItems.orderId, order.id),
      ),
      columns: { productId: true, quantity: true },
    });

    await this.lifecycle.handleStatusChange({
      tenantId,
      orderId: order.id,
      previous,
      next: dto.status,
      items: items
        .filter((i): i is { productId: string; quantity: number } =>
          Boolean(i.productId),
        )
        .map((i) => ({ productId: i.productId, quantity: i.quantity })),
    });

    const updated = await this.reader.findOne(tenantId, orderNumber);
    this.events.emitOrderUpdated(tenantId, updated);
    this.events.emitOrderStatusChanged(tenantId, {
      id: updated.id,
      orderNumber: updated.orderNumber,
      status: dto.status,
      previousStatus: previous,
      decorationReview: this.lifecycle.describeDecorationReview(dto.status),
    });
    this.events.emitDashboardStatsUpdate(tenantId);
    return updated;
  }
}
