import { Injectable, Inject, NotFoundException, BadRequestException } from "@nestjs/common";
import { eq, and, desc, sql } from "drizzle-orm";
import { orders, orderItems, orderStatusHistory, products, customers } from "../database/schema";
import { CreateOrderDto, UpdateOrderStatusDto, OrderQueryDto } from "./dto/order.dto";

@Injectable()
export class OrderService {
  constructor(@Inject("DATABASE") private db: any) {}

  async findAll(tenantId: string, query: OrderQueryDto) {
    const { customerId, status, limit = 20, offset = 0 } = query;

    const conditions = [eq(orders.tenantId, tenantId)];

    if (customerId) {
      conditions.push(eq(orders.customerId, customerId));
    }

    if (status) {
      conditions.push(eq(orders.status, status as typeof orders.status['_']['data']));
    }

    const items = await this.db.query.orders.findMany({
      where: and(...conditions),
      limit,
      offset,
      orderBy: desc(orders.createdAt),
      with: {
        items: true,
        customer: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    const total = await this.db
      .select({ count: sql`count(*)::int` })
      .from(orders)
      .where(and(...conditions));

    return {
      items,
      total: total[0]?.count || 0,
      limit,
      offset,
    };
  }

  async findOne(tenantId: string, orderNumber: string) {
    const order = await this.db.query.orders.findFirst({
      where: and(eq(orders.tenantId, tenantId), eq(orders.orderNumber, orderNumber)),
      with: {
        items: true,
        customer: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderNumber} not found`);
    }

    return order;
  }

  async create(tenantId: string, tenantSlug: string, dto: CreateOrderDto) {
    // Generate order number
    const orderNumber = await this.generateOrderNumber(tenantId, tenantSlug);

    // Calculate totals
    let subtotal = 0;
    for (const item of dto.items) {
      subtotal += item.price * item.quantity;
    }

    const shippingAmount = 0; // TODO: Calculate shipping
    const discountAmount = 0; // TODO: Apply coupons
    const total = subtotal + shippingAmount - discountAmount;

    // Create order
    const [order] = await this.db
      .insert(orders)
      .values({
        tenantId,
        customerId: dto.customerId,
        orderNumber,
        status: "pending",
        paymentStatus: "pending",
        subtotal: subtotal.toString(),
        shippingAmount: shippingAmount.toString(),
        discountAmount: discountAmount.toString(),
        total: total.toString(),
        shippingAddress: dto.shippingAddress,
        billingAddress: dto.billingAddress || dto.shippingAddress,
        customerNotes: dto.customerNotes,
      })
      .returning();

    // Create order items
    for (const item of dto.items) {
      await this.db.insert(orderItems).values({
        tenantId,
        orderId: order.id,
        productId: item.productId,
        variationId: item.variationId,
        name: item.name,
        quantity: item.quantity,
        price: item.price.toString(),
        total: (item.price * item.quantity).toString(),
        imageUrl: item.imageUrl,
      });
    }

    // Create status history entry
    await this.db.insert(orderStatusHistory).values({
      tenantId,
      orderId: order.id,
      status: "pending",
      notes: "Order created",
    });

    return this.findOne(tenantId, orderNumber);
  }

  async updateStatus(tenantId: string, orderNumber: string, dto: UpdateOrderStatusDto) {
    const order = await this.findOne(tenantId, orderNumber);

    await this.db
      .update(orders)
      .set({
        status: dto.status,
        updatedAt: new Date(),
      })
      .where(and(eq(orders.tenantId, tenantId), eq(orders.id, order.id)));

    // Add status history
    await this.db.insert(orderStatusHistory).values({
      tenantId,
      orderId: order.id,
      status: dto.status,
      notes: dto.notes,
    });

    return this.findOne(tenantId, orderNumber);
  }

  private async generateOrderNumber(tenantId: string, tenantSlug: string): Promise<string> {
    // Get tenant order prefix
    const tenant = await this.db.query.tenants.findFirst({
      where: eq(orders.tenantId, tenantId),
    });

    const prefix = tenant?.orderPrefix || tenantSlug.toUpperCase().slice(0, 3);
    
    // Get count of orders for this tenant
    const count = await this.db
      .select({ count: sql`count(*)::int` })
      .from(orders)
      .where(eq(orders.tenantId, tenantId));

    const nextNumber = (count[0]?.count || 0) + 1;
    const paddedNumber = nextNumber.toString().padStart(4, "0");

    return `${prefix}-${paddedNumber}`;
  }

  async getCustomerOrders(tenantId: string, customerId: string, limit = 10) {
    return this.db.query.orders.findMany({
      where: and(eq(orders.tenantId, tenantId), eq(orders.customerId, customerId)),
      limit,
      orderBy: desc(orders.createdAt),
      with: {
        items: {
          columns: {
            id: true,
            name: true,
            quantity: true,
            price: true,
            imageUrl: true,
          },
        },
      },
    });
  }
}
