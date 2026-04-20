import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import {
  DROPSHIPPING_QUEUE_NAME,
  type DropshippingQueueJobPayload,
} from "@gaqno-development/types";
import {
  OrderPlacementService,
  type PlacementOutcome,
} from "./order-placement.service";

@Processor(DROPSHIPPING_QUEUE_NAME)
export class DropshippingQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(DropshippingQueueProcessor.name);

  constructor(private readonly placement: OrderPlacementService) {
    super();
  }

  async process(job: Job<DropshippingQueueJobPayload>): Promise<PlacementOutcome> {
    const payload: DropshippingQueueJobPayload = {
      ...job.data,
      attempt: job.attemptsMade + 1,
    };
    this.logger.log(
      `[${DROPSHIPPING_QUEUE_NAME}] order=${payload.orderId} attempt=${payload.attempt}`,
    );
    return this.placement.placeOrder(payload);
  }
}
