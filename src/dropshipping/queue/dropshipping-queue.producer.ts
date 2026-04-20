import { Inject, Injectable } from "@nestjs/common";
import {
  DROPSHIPPING_QUEUE_NAME,
  type DropshippingQueueJobPayload,
} from "@gaqno-development/types";

export interface BullQueueLike {
  add(
    name: string,
    data: DropshippingQueueJobPayload,
    options?: BullJobOptionsLike,
  ): Promise<unknown>;
  getJobCounts(): Promise<Record<string, number>>;
}

export interface BullJobOptionsLike {
  readonly jobId?: string;
  readonly attempts?: number;
  readonly backoff?: {
    readonly type: "exponential" | "fixed";
    readonly delay: number;
  };
  readonly removeOnComplete?: boolean | number;
  readonly removeOnFail?: boolean | number;
}

export const DROPSHIPPING_QUEUE_TOKEN = Symbol("DROPSHIPPING_QUEUE_TOKEN");

export const DEFAULT_JOB_OPTIONS: BullJobOptionsLike = {
  attempts: 5,
  backoff: { type: "exponential", delay: 30_000 },
  removeOnComplete: 500,
  removeOnFail: 1_000,
};

@Injectable()
export class DropshippingQueueProducer {
  constructor(
    @Inject(DROPSHIPPING_QUEUE_TOKEN) private readonly queue: BullQueueLike,
  ) {}

  async enqueue(payload: DropshippingQueueJobPayload): Promise<void> {
    await this.queue.add(DROPSHIPPING_QUEUE_NAME, payload, {
      ...DEFAULT_JOB_OPTIONS,
      jobId: this.buildIdempotentId(payload),
    });
  }

  async counts(): Promise<Record<string, number>> {
    return this.queue.getJobCounts();
  }

  private buildIdempotentId(payload: DropshippingQueueJobPayload): string {
    return `ds:${payload.tenantId}:${payload.orderId}`;
  }
}
