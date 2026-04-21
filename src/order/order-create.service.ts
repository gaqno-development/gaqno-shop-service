import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import {
  decorations,
  orderItemDecorations,
  orderItems,
  orderStatusHistory,
  orders,
} from "../database/schema";
import { ShopDatabase } from "../database/shop-database.type";
import { EventsService } from "../events/events.service";
import { BakeryOrderLifecycleService } from "../bakery/order-lifecycle/bakery-order-lifecycle.service";
import { CreateOrderDto } from "./dto/order.dto";
import { generateOrderNumber } from "./order-number.util";
import { OrderReadService } from "./order-read.service";

interface OrderTotals {
  subtotal: number;
  shippingAmount: number;
  discountAmount: number;
  total: number;
}

function calculateTotals(items: CreateOrderDto["items"]): OrderTotals {
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const shippingAmount = 0;
  const discountAmount = 0;
  const total = subtotal + shippingAmount - discountAmount;
  return { subtotal, shippingAmount, discountAmount, total };
}

function buildMetadata(dto: CreateOrderDto): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  if (dto.deliveryDate) meta.deliveryDate = dto.deliveryDate;
  if (dto.deliveryTime) meta.deliveryTime = dto.deliveryTime;
  if (typeof dto.deliveryIsPickup === "boolean") {
    meta.deliveryIsPickup = dto.deliveryIsPickup;
  }
  return meta;
}

@Injectable()
export class OrderCreateService {
  constructor(
    @Inject("DATABASE") private readonly db: ShopDatabase,
    private readonly reader: OrderReadService,
    private readonly events: EventsService,
    private readonly lifecycle: BakeryOrderLifecycleService,
  ) {}

  async create(tenantId: string, tenantSlug: string, dto: CreateOrderDto) {
    if (dto.deliveryDate) {
      await this.lifecycle.validateLeadDaysForOrder({
        tenantId,
        deliveryDate: new Date(dto.deliveryDate),
        items: dto.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
      });
    }

    const orderNumber = await generateOrderNumber(this.db, tenantId, tenantSlug);
    const totals = calculateTotals(dto.items);
    const metadata = buildMetadata(dto);

    const [order] = await this.db
      .insert(orders)
      .values({
        tenantId,
        customerId: dto.customerId,
        orderNumber,
        status: "pending",
        paymentStatus: "pending",
        subtotal: totals.subtotal.toString(),
        shippingAmount: totals.shippingAmount.toString(),
        discountAmount: totals.discountAmount.toString(),
        total: totals.total.toString(),
        shippingAddress: dto.shippingAddress,
        billingAddress: dto.billingAddress ?? dto.shippingAddress,
        customerNotes: dto.customerNotes,
        metadata,
      })
      .returning();

    await this.insertItems(tenantId, order.id, dto.items);
    await this.db.insert(orderStatusHistory).values({
      tenantId,
      orderId: order.id,
      status: "pending",
      notes: "Order created",
    });

    const created = await this.reader.findOne(tenantId, orderNumber);
    this.events.emitOrderCreated(tenantId, created);
    this.events.emitDashboardStatsUpdate(tenantId);
    return created;
  }

  private async insertItems(
    tenantId: string,
    orderId: string,
    items: CreateOrderDto["items"],
  ): Promise<void> {
    for (const item of items) {
      const [inserted] = await this.db
        .insert(orderItems)
        .values({
          tenantId,
          orderId,
          productId: item.productId,
          variationId: item.variationId,
          name: item.name,
          quantity: item.quantity,
          price: item.price.toString(),
          total: (item.price * item.quantity).toString(),
          imageUrl: item.imageUrl,
          referenceImageUrl: item.referenceImageUrl,
          size: item.size,
          notes: item.notes,
        })
        .returning();

      if (item.decorations && item.decorations.length > 0 && inserted) {
        await this.insertItemDecorations(
          tenantId,
          inserted.id,
          item.decorations,
        );
      }
    }
  }

  private async insertItemDecorations(
    tenantId: string,
    orderItemId: string,
    picks: readonly {
      decorationId: string;
      customText?: string | null;
    }[],
  ): Promise<void> {
    const ids = picks.map((p) => p.decorationId);
    const rows = await this.db
      .select({ id: decorations.id, price: decorations.price })
      .from(decorations)
      .where(
        and(eq(decorations.tenantId, tenantId), inArray(decorations.id, ids)),
      );
    const priceById = new Map(rows.map((r) => [r.id, r.price]));
    for (const pick of picks) {
      await this.db.insert(orderItemDecorations).values({
        tenantId,
        orderItemId,
        decorationId: pick.decorationId,
        customText: pick.customText ?? null,
        price: priceById.get(pick.decorationId) ?? "0",
      });
    }
  }
}
