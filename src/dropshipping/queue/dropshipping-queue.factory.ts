import { Queue } from "bullmq";
import {
  DROPSHIPPING_QUEUE_NAME,
  type DropshippingQueueJobPayload,
} from "@gaqno-development/types";
import type {
  BullQueueLike,
  BullJobOptionsLike,
} from "./dropshipping-queue.producer";

export interface BullQueueConnection {
  readonly host: string;
  readonly port: number;
  readonly password?: string;
  readonly db?: number;
}

export function parseRedisUrl(url: string | undefined): BullQueueConnection {
  if (!url) return { host: "localhost", port: 6379 };
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
    db: parsed.pathname ? Number(parsed.pathname.replace("/", "")) || 0 : 0,
  };
}

export function createDropshippingQueue(
  connection: BullQueueConnection,
): BullQueueLike {
  const queue = new Queue<DropshippingQueueJobPayload>(
    DROPSHIPPING_QUEUE_NAME,
    { connection },
  );
  return {
    async add(name, data, options?: BullJobOptionsLike) {
      return queue.add(name, data, options);
    },
    async getJobCounts() {
      return queue.getJobCounts();
    },
  };
}

export function createNoopQueue(): BullQueueLike {
  return {
    async add() {
      return undefined;
    },
    async getJobCounts() {
      return {};
    },
  };
}
