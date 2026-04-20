import { Test } from "@nestjs/testing";
import { PaymentApprovedListener } from "./payment-approved.listener";
import {
  DropshippingQueueProducer,
  DROPSHIPPING_QUEUE_TOKEN,
  type BullQueueLike,
} from "./dropshipping-queue.producer";
import type { PaymentApprovedEvent } from "./payment-approved.event";

function createQueue(): jest.Mocked<BullQueueLike> {
  return {
    add: jest.fn().mockResolvedValue(undefined),
    getJobCounts: jest.fn().mockResolvedValue({}),
  };
}

async function bootstrap() {
  const queue = createQueue();
  const module = await Test.createTestingModule({
    providers: [
      DropshippingQueueProducer,
      PaymentApprovedListener,
      { provide: DROPSHIPPING_QUEUE_TOKEN, useValue: queue },
    ],
  }).compile();
  return {
    listener: module.get(PaymentApprovedListener),
    queue,
  };
}

describe("PaymentApprovedListener", () => {
  it("enqueues dropshipping fulfillment orders with resolved provider", async () => {
    const { listener, queue } = await bootstrap();
    const event: PaymentApprovedEvent = {
      tenantId: "t-1",
      orderId: "o-1",
      fulfillmentType: "dropshipping",
      supplierProviderCode: "aliexpress",
      occurredAt: new Date().toISOString(),
    };

    await listener.handle(event);

    expect(queue.add).toHaveBeenCalledWith(
      "dropshipping.place-order",
      expect.objectContaining({
        orderId: "o-1",
        tenantId: "t-1",
        providerCode: "aliexpress",
      }),
      expect.any(Object),
    );
  });

  it("ignores non-dropshipping orders", async () => {
    const { listener, queue } = await bootstrap();

    await listener.handle({
      tenantId: "t-1",
      orderId: "o-1",
      fulfillmentType: "own",
      occurredAt: new Date().toISOString(),
    });

    expect(queue.add).not.toHaveBeenCalled();
  });

  it("falls back to aliexpress when no provider code is set", async () => {
    const { listener, queue } = await bootstrap();

    await listener.handle({
      tenantId: "t-1",
      orderId: "o-2",
      fulfillmentType: "dropshipping",
      occurredAt: new Date().toISOString(),
    });

    expect(queue.add).toHaveBeenCalledWith(
      "dropshipping.place-order",
      expect.objectContaining({ providerCode: "aliexpress" }),
      expect.any(Object),
    );
  });
});
