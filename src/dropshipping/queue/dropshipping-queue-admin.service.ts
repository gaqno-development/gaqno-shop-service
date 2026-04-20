import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";
import type {
  DropshippingOrderTicket,
  DropshippingQueueMetrics,
  DropshippingTicketListItem,
  DropshippingTicketListResponse,
} from "@gaqno-development/types";
import type { ShopDatabase } from "../../database/shop-database.type";
import { dropshippingOrderTickets } from "../../database/schema/dropshipping";
import { orders } from "../../database/schema/order";
import { customers } from "../../database/schema/customer";
import { DropshippingQueueProducer } from "./dropshipping-queue.producer";
import {
  DROPSHIPPING_TICKET_REPOSITORY,
  type DropshippingTicketRepositoryPort,
} from "./order-placement.types";

export interface ListQueueInput {
  readonly tenantId: string;
  readonly status?: "open" | "retrying" | "resolved" | "cancelled";
  readonly page?: number;
  readonly pageSize?: number;
}

@Injectable()
export class DropshippingQueueAdminService {
  private static readonly DEFAULT_PAGE_SIZE = 20;

  constructor(
    @Inject("DATABASE") private readonly db: ShopDatabase,
    @Inject(DROPSHIPPING_TICKET_REPOSITORY)
    private readonly tickets: DropshippingTicketRepositoryPort,
    private readonly producer: DropshippingQueueProducer,
  ) {}

  async list(input: ListQueueInput): Promise<DropshippingTicketListResponse> {
    const page = input.page ?? 1;
    const pageSize =
      input.pageSize ?? DropshippingQueueAdminService.DEFAULT_PAGE_SIZE;
    const offset = (page - 1) * pageSize;

    const rows = await this.runListQuery(input, pageSize, offset);
    const total = await this.runCountQuery(input);
    return {
      items: rows.map((row) => this.toListItem(row)),
      total,
      page,
      pageSize,
    };
  }

  async metrics(tenantId: string): Promise<DropshippingQueueMetrics> {
    const rows = await this.db
      .select({
        status: orders.fulfillmentStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, tenantId),
          eq(orders.fulfillmentType, "dropshipping"),
        ),
      )
      .groupBy(orders.fulfillmentStatus);

    const byStatus = new Map<string, number>(
      rows.map((r) => [r.status ?? "pending", Number(r.count)]),
    );
    return {
      queued: byStatus.get("queued") ?? 0,
      placing: byStatus.get("placing") ?? 0,
      placed: byStatus.get("placed") ?? 0,
      onHold: byStatus.get("on_hold") ?? 0,
      cancelled: byStatus.get("cancelled") ?? 0,
    };
  }

  async retry(
    ticketId: string,
    tenantId: string,
    notes?: string,
  ): Promise<DropshippingOrderTicket> {
    const ticket = await this.loadTicket(ticketId, tenantId);
    await this.producer.enqueue({
      orderId: ticket.orderId,
      tenantId,
      providerCode: ticket.providerCode,
      attempt: ticket.attempts + 1,
    });
    return this.tickets.markResolved(ticketId, tenantId, notes);
  }

  async cancel(
    ticketId: string,
    tenantId: string,
    reason: string,
  ): Promise<DropshippingOrderTicket> {
    const ticket = await this.loadTicket(ticketId, tenantId);
    await this.db
      .update(orders)
      .set({ fulfillmentStatus: "cancelled", updatedAt: new Date() })
      .where(
        and(eq(orders.id, ticket.orderId), eq(orders.tenantId, tenantId)),
      );
    return this.tickets.markCancelled(ticketId, tenantId, reason);
  }

  private async loadTicket(
    ticketId: string,
    tenantId: string,
  ): Promise<DropshippingOrderTicket> {
    const [row] = await this.db
      .select()
      .from(dropshippingOrderTickets)
      .where(
        and(
          eq(dropshippingOrderTickets.id, ticketId),
          eq(dropshippingOrderTickets.tenantId, tenantId),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException(`Ticket ${ticketId} not found`);
    return {
      id: row.id,
      tenantId: row.tenantId,
      orderId: row.orderId,
      providerCode: row.providerCode,
      status: row.status as DropshippingOrderTicket["status"],
      failureReason: row.failureReason,
      failureKind: row.failureKind as DropshippingOrderTicket["failureKind"],
      attempts: row.attempts ?? 0,
      createdAt: row.createdAt?.toISOString() ?? "",
      updatedAt: row.updatedAt?.toISOString() ?? "",
      resolvedAt: row.resolvedAt?.toISOString(),
      resolutionNotes: row.resolutionNotes ?? undefined,
    };
  }

  private async runListQuery(
    input: ListQueueInput,
    pageSize: number,
    offset: number,
  ) {
    const where = this.buildWhere(input);
    return this.db
      .select({
        ticket: dropshippingOrderTickets,
        orderNumber: orders.orderNumber,
        orderTotal: orders.total,
        customerFirstName: customers.firstName,
        customerLastName: customers.lastName,
      })
      .from(dropshippingOrderTickets)
      .leftJoin(orders, eq(orders.id, dropshippingOrderTickets.orderId))
      .leftJoin(customers, eq(customers.id, orders.customerId))
      .where(where)
      .orderBy(desc(dropshippingOrderTickets.createdAt))
      .limit(pageSize)
      .offset(offset);
  }

  private async runCountQuery(input: ListQueueInput): Promise<number> {
    const where = this.buildWhere(input);
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(dropshippingOrderTickets)
      .where(where);
    return Number(row?.count ?? 0);
  }

  private buildWhere(input: ListQueueInput) {
    const clauses = [eq(dropshippingOrderTickets.tenantId, input.tenantId)];
    if (input.status) {
      clauses.push(eq(dropshippingOrderTickets.status, input.status));
    }
    return and(...clauses);
  }

  private toListItem(row: {
    ticket: typeof dropshippingOrderTickets.$inferSelect;
    orderNumber: string | null;
    orderTotal: string | null;
    customerFirstName: string | null;
    customerLastName: string | null;
  }): DropshippingTicketListItem {
    const customerName = [row.customerFirstName, row.customerLastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    return {
      ticket: {
        id: row.ticket.id,
        tenantId: row.ticket.tenantId,
        orderId: row.ticket.orderId,
        providerCode: row.ticket.providerCode,
        status: row.ticket.status as DropshippingOrderTicket["status"],
        failureReason: row.ticket.failureReason,
        failureKind:
          row.ticket.failureKind as DropshippingOrderTicket["failureKind"],
        attempts: row.ticket.attempts ?? 0,
        createdAt: row.ticket.createdAt?.toISOString() ?? "",
        updatedAt: row.ticket.updatedAt?.toISOString() ?? "",
        resolvedAt: row.ticket.resolvedAt?.toISOString(),
        resolutionNotes: row.ticket.resolutionNotes ?? undefined,
      },
      orderNumber: row.orderNumber ?? "",
      orderTotal: Number(row.orderTotal ?? 0),
      customerName,
      createdAt: row.ticket.createdAt?.toISOString() ?? "",
    };
  }
}
