import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { DropshippingOrderTicket } from "@gaqno-development/types";
import type { ShopDatabase } from "../../database/shop-database.type";
import { dropshippingOrderTickets } from "../../database/schema/dropshipping";
import type {
  DropshippingTicketRepositoryPort,
  OpenTicketInput,
} from "./order-placement.types";

type TicketRow = typeof dropshippingOrderTickets.$inferSelect;

@Injectable()
export class DropshippingTicketRepository
  implements DropshippingTicketRepositoryPort
{
  constructor(@Inject("DATABASE") private readonly db: ShopDatabase) {}

  async openOrUpdate(input: OpenTicketInput): Promise<DropshippingOrderTicket> {
    const existing = await this.findByOrder(input.orderId, input.tenantId);
    if (existing) return this.incrementAttempts(existing.id, input);
    return this.insertTicket(input);
  }

  async markResolved(
    ticketId: string,
    tenantId: string,
    notes?: string,
  ): Promise<DropshippingOrderTicket> {
    const [row] = await this.db
      .update(dropshippingOrderTickets)
      .set({
        status: "resolved",
        resolvedAt: new Date(),
        resolutionNotes: notes ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(dropshippingOrderTickets.id, ticketId),
          eq(dropshippingOrderTickets.tenantId, tenantId),
        ),
      )
      .returning();
    return this.toTicket(row);
  }

  async markCancelled(
    ticketId: string,
    tenantId: string,
    reason: string,
  ): Promise<DropshippingOrderTicket> {
    const [row] = await this.db
      .update(dropshippingOrderTickets)
      .set({
        status: "cancelled",
        resolvedAt: new Date(),
        resolutionNotes: reason,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(dropshippingOrderTickets.id, ticketId),
          eq(dropshippingOrderTickets.tenantId, tenantId),
        ),
      )
      .returning();
    return this.toTicket(row);
  }

  async findByOrder(
    orderId: string,
    tenantId: string,
  ): Promise<DropshippingOrderTicket | undefined> {
    const [row] = await this.db
      .select()
      .from(dropshippingOrderTickets)
      .where(
        and(
          eq(dropshippingOrderTickets.orderId, orderId),
          eq(dropshippingOrderTickets.tenantId, tenantId),
        ),
      )
      .limit(1);
    return row ? this.toTicket(row) : undefined;
  }

  private async insertTicket(
    input: OpenTicketInput,
  ): Promise<DropshippingOrderTicket> {
    const [row] = await this.db
      .insert(dropshippingOrderTickets)
      .values({
        tenantId: input.tenantId,
        orderId: input.orderId,
        providerCode: input.providerCode,
        failureReason: input.failureReason,
        failureKind: input.failureKind,
        attempts: 1,
      })
      .returning();
    return this.toTicket(row);
  }

  private async incrementAttempts(
    id: string,
    input: OpenTicketInput,
  ): Promise<DropshippingOrderTicket> {
    const [row] = await this.db
      .update(dropshippingOrderTickets)
      .set({
        status: "open",
        failureReason: input.failureReason,
        failureKind: input.failureKind,
        updatedAt: new Date(),
      })
      .where(eq(dropshippingOrderTickets.id, id))
      .returning();
    return this.toTicket({
      ...row,
      attempts: (row.attempts ?? 0) + 1,
    });
  }

  private toTicket(row: TicketRow): DropshippingOrderTicket {
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
}
