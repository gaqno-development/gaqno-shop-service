import { Test } from "@nestjs/testing";
import {
  DropshippingQueueProducer,
  DROPSHIPPING_QUEUE_TOKEN,
  type BullQueueLike,
} from "./dropshipping-queue.producer";

function createQueue(): jest.Mocked<BullQueueLike> {
  return {
    add: jest.fn().mockResolvedValue(undefined),
    getJobCounts: jest
      .fn()
      .mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0 }),
  };
}

async function buildProducer(queue: BullQueueLike) {
  const module = await Test.createTestingModule({
    providers: [
      DropshippingQueueProducer,
      { provide: DROPSHIPPING_QUEUE_TOKEN, useValue: queue },
    ],
  }).compile();
  return module.get(DropshippingQueueProducer);
}

describe("DropshippingQueueProducer", () => {
  it("adds a job with exponential backoff and idempotent id", async () => {
    const queue = createQueue();
    const producer = await buildProducer(queue);

    await producer.enqueue({
      orderId: "order-1",
      tenantId: "tenant-1",
      providerCode: "aliexpress",
      attempt: 1,
    });

    expect(queue.add).toHaveBeenCalledWith(
      "dropshipping.place-order",
      expect.objectContaining({ orderId: "order-1" }),
      expect.objectContaining({
        jobId: "ds:tenant-1:order-1",
        attempts: 5,
        backoff: { type: "exponential", delay: 30_000 },
      }),
    );
  });

  it("returns queue counts", async () => {
    const queue = createQueue();
    queue.getJobCounts.mockResolvedValueOnce({
      waiting: 3,
      active: 1,
      completed: 42,
      failed: 2,
    });
    const producer = await buildProducer(queue);
    const counts = await producer.counts();

    expect(counts).toEqual({ waiting: 3, active: 1, completed: 42, failed: 2 });
  });
});
