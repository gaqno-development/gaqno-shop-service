import { Inject, Injectable } from "@nestjs/common";
import { orders, orderItems, orderStatusHistory } from "../database/schema";
import { ShopDatabase } from "../database/shop-database.type";
import { EventsService } from "../events/events.service";
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

@Injectable()
export class OrderCreateService {
  constructor(
    @Inject("DATABASE") private readonly db: ShopDatabase,
    private readonly reader: OrderReadService,
    private readonly events: EventsService,
  ) {}

  async create(tenantId: string, tenantSlug: string, dto: CreateOrderDto) {
    const orderNumber = await generateOrderNumber(this.db, tenantId, tenantSlug);
    const totals = calculateTotals(dto.items);

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
      await this.db.insert(orderItems).values({
        tenantId,
        orderId,
        productId: item.productId,
        variationId: item.variationId,
        name: item.name,
        quantity: item.quantity,
        price: item.price.toString(),
        total: (item.price * item.quantity).toString(),
        imageUrl: item.imageUrl,
      });
    }
  }
}
