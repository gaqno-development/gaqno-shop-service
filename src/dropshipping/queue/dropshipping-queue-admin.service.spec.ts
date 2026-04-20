import { Test } from "@nestjs/testing";
import type { DropshippingOrderTicket } from "@gaqno-development/types";
import { DropshippingQueueAdminService } from "./dropshipping-queue-admin.service";
import {
  DropshippingQueueProducer,
  DROPSHIPPING_QUEUE_TOKEN,
  type BullQueueLike,
} from "./dropshipping-queue.producer";
import {
  DROPSHIPPING_TICKET_REPOSITORY,
  type DropshippingTicketRepositoryPort,
} from "./order-placement.types";

const TICKET: DropshippingOrderTicket = {
  id: "ticket-1",
  tenantId: "tenant-1",
  orderId: "order-1",
  providerCode: "aliexpress",
  status: "open",
  failureReason: "SKU esgotado",
  failureKind: "out_of_stock",
  attempts: 1,
  createdAt: "2026-04-20T00:00:00.000Z",
  updatedAt: "2026-04-20T00:00:00.000Z",
};

function createQueue(): jest.Mocked<BullQueueLike> {
  return {
    add: jest.fn().mockResolvedValue(undefined),
    getJobCounts: jest.fn().mockResolvedValue({}),
  };
}

function createTicketRepo(): jest.Mocked<DropshippingTicketRepositoryPort> {
  return {
    openOrUpdate: jest.fn(),
    markResolved: jest.fn().mockResolvedValue({ ...TICKET, status: "resolved" }),
    markCancelled: jest
      .fn()
      .mockResolvedValue({ ...TICKET, status: "cancelled" }),
    findByOrder: jest.fn(),
  };
}

function createDb(): { [key: string]: jest.Mock } {
  const updateChain = {
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue(undefined),
  };
  const selectChain = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([
      {
        id: TICKET.id,
        tenantId: TICKET.tenantId,
        orderId: TICKET.orderId,
        providerCode: TICKET.providerCode,
        status: TICKET.status,
        failureReason: TICKET.failureReason,
        failureKind: TICKET.failureKind,
        attempts: TICKET.attempts,
        createdAt: new Date(TICKET.createdAt),
        updatedAt: new Date(TICKET.updatedAt),
        resolvedAt: null,
        resolutionNotes: null,
      },
    ]),
  };
  return {
    update: jest.fn(() => updateChain) as unknown as jest.Mock,
    select: jest.fn(() => selectChain) as unknown as jest.Mock,
  };
}

async function buildService() {
  const db = createDb();
  const queue = createQueue();
  const tickets = createTicketRepo();
  const module = await Test.createTestingModule({
    providers: [
      DropshippingQueueAdminService,
      DropshippingQueueProducer,
      { provide: "DATABASE", useValue: db },
      { provide: DROPSHIPPING_QUEUE_TOKEN, useValue: queue },
      { provide: DROPSHIPPING_TICKET_REPOSITORY, useValue: tickets },
    ],
  }).compile();
  return {
    service: module.get(DropshippingQueueAdminService),
    queue,
    tickets,
    db,
  };
}

describe("DropshippingQueueAdminService", () => {
  it("retries ticket: enqueues a new placement job and resolves ticket", async () => {
    const { service, queue, tickets } = await buildService();

    const result = await service.retry("ticket-1", "tenant-1", "trying again");

    expect(queue.add).toHaveBeenCalledWith(
      "dropshipping.place-order",
      expect.objectContaining({ orderId: "order-1", providerCode: "aliexpress" }),
      expect.any(Object),
    );
    expect(tickets.markResolved).toHaveBeenCalledWith(
      "ticket-1",
      "tenant-1",
      "trying again",
    );
    expect(result.status).toBe("resolved");
  });

  it("cancels ticket: flags order cancelled and marks ticket cancelled", async () => {
    const { service, tickets, db } = await buildService();

    const result = await service.cancel(
      "ticket-1",
      "tenant-1",
      "customer gave up",
    );

    expect(db.update).toHaveBeenCalled();
    expect(tickets.markCancelled).toHaveBeenCalledWith(
      "ticket-1",
      "tenant-1",
      "customer gave up",
    );
    expect(result.status).toBe("cancelled");
  });
});
