import { BadRequestException, Inject, Injectable, Optional } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { orderItems, orders, orderStatusHistory } from "../database/schema";
import { ShopDatabase } from "../database/shop-database.type";
import { EventsService } from "../events/events.service";
import { ORDER_LIFECYCLE_PLUGIN, OrderLifecyclePlugin } from "./order-lifecycle.plugin";
import { UpdateOrderStatusDto } from "./dto/order.dto";
import { OrderReadService } from "./order-read.service";

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "awaiting_decoration_review",
  "decoration_approved",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;

type OrderStatus = (typeof ORDER_STATUSES)[number];

function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

@Injectable()
export class OrderStatusService {
  constructor(
    @Inject("DATABASE") private readonly db: ShopDatabase,
    private readonly reader: OrderReadService,
    private readonly events: EventsService,
    @Optional() @Inject(ORDER_LIFECYCLE_PLUGIN) private readonly lifecycle?: OrderLifecyclePlugin,
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
    const previous = order.status ?? "pending";
    if (this.lifecycle) {
      this.lifecycle.assertTransition(previous, dto.status);
    }

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

    if (this.lifecycle) {
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
    }

    const updated = await this.reader.findOne(tenantId, orderNumber);
    this.events.emitOrderUpdated(tenantId, updated);
    this.events.emitOrderStatusChanged(tenantId, {
      id: updated.id,
      orderNumber: updated.orderNumber,
      status: dto.status,
      previousStatus: previous,
      decorationReview: this.lifecycle
        ? this.lifecycle.describeDecorationReview(dto.status)
        : false,
    });
    this.events.emitDashboardStatsUpdate(tenantId);
    return updated;
  }
}
