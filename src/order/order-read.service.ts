import {
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { orders, orderStatusHistory } from "../database/schema";
import { ShopDatabase } from "../database/shop-database.type";
import { OrderQueryDto } from "./dto/order.dto";

type OrderStatusLiteral = typeof orders.status._.data;

@Injectable()
export class OrderReadService {
  constructor(@Inject("DATABASE") private readonly db: ShopDatabase) {}

  async findAll(tenantId: string, query: OrderQueryDto) {
    const { customerId, status } = query;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = query.offset ?? (page - 1) * limit;
    const conditions = [eq(orders.tenantId, tenantId)];
    if (customerId) conditions.push(eq(orders.customerId, customerId));
    if (status) {
      conditions.push(eq(orders.status, status as OrderStatusLiteral));
    }

    const data = await this.db.query.orders.findMany({
      where: and(...conditions),
      limit,
      offset,
      orderBy: desc(orders.createdAt),
      with: {
        items: true,
        customer: {
          columns: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    const totalRow = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(...conditions));
    const total = totalRow[0]?.count ?? 0;

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(tenantId: string, identifier: string) {
    const order = await this.db.query.orders.findFirst({
      where: and(
        eq(orders.tenantId, tenantId),
        or(eq(orders.orderNumber, identifier), eq(orders.id, identifier)),
      ),
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
      throw new NotFoundException(`Order ${identifier} not found`);
    }
    return order;
  }

  async getCustomerOrders(
    tenantId: string,
    customerId: string,
    options: { page: number; limit: number; status?: string },
  ) {
    const { page, limit, status } = options;
    const offset = (page - 1) * limit;
    const conditions = [
      eq(orders.tenantId, tenantId),
      eq(orders.customerId, customerId),
    ];
    if (status) {
      conditions.push(eq(orders.status, status as OrderStatusLiteral));
    }

    const items = await this.db.query.orders.findMany({
      where: and(...conditions),
      limit,
      offset,
      orderBy: [desc(orders.createdAt)],
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

    const totalRow = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(...conditions));
    const total = totalRow[0]?.count ?? 0;

    return {
      items: items.map((order) => ({ ...order, items: order.items?.length ?? 0 })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getCustomerOrderDetail(
    tenantId: string,
    customerId: string,
    orderId: string,
  ) {
    const order = await this.db.query.orders.findFirst({
      where: and(
        eq(orders.tenantId, tenantId),
        eq(orders.id, orderId),
        eq(orders.customerId, customerId),
      ),
      with: { items: true },
    });
    if (!order) throw new NotFoundException("Pedido não encontrado");

    const history = await this.db.query.orderStatusHistory.findMany({
      where: and(
        eq(orderStatusHistory.tenantId, tenantId),
        eq(orderStatusHistory.orderId, orderId),
      ),
      orderBy: [desc(orderStatusHistory.createdAt)],
    });

    return { ...order, statusHistory: history };
  }

  async trackByNumberAndEmail(
    tenantId: string,
    orderNumber: string,
    email: string,
  ) {
    const order = await this.db.query.orders.findFirst({
      where: and(
        eq(orders.tenantId, tenantId),
        eq(orders.orderNumber, orderNumber),
      ),
      with: { customer: true, items: true },
    });
    if (!order || order.customer?.email !== email) {
      throw new NotFoundException("Pedido não encontrado");
    }
    return {
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt,
      total: order.total,
      items: order.items,
    };
  }
}
