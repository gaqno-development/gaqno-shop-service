import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { orders, orderStatusHistory } from "../database/schema";
import { ShopDatabase } from "../database/shop-database.type";
import { UpdateOrderStatusDto } from "./dto/order.dto";
import { OrderReadService } from "./order-read.service";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

const ORDER_STATUSES: readonly OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

@Injectable()
export class OrderStatusService {
  constructor(
    @Inject("DATABASE") private readonly db: ShopDatabase,
    private readonly reader: OrderReadService,
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

    return this.reader.findOne(tenantId, orderNumber);
  }
}
