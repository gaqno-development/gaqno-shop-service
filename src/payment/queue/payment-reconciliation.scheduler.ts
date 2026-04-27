import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import type { Job } from "bullmq";
import { and, eq, lt } from "drizzle-orm";
import { orders } from "../../database/schema";
import { ShopDatabase } from "../../database/shop-database.type";
import type { PaymentReconciliationJobPayload } from "./payment-reconciliation.types";

const STALE_PAYMENT_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
const PAYMENT_RECONCILIATION_QUEUE_NAME = "payment-reconciliation";

@Injectable()
export class PaymentReconciliationScheduler implements OnModuleInit {
  private readonly logger = new Logger(PaymentReconciliationScheduler.name);

  constructor(
    @Inject("DATABASE") private readonly db: ShopDatabase,
    @InjectQueue(PAYMENT_RECONCILIATION_QUEUE_NAME)
    private readonly reconciliationQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.reconciliationQueue.add(
      "scan-stale-payments",
      {},
      {
        repeat: { pattern: "*/15 * * * *" }, // Every 15 minutes
      },
    );
    this.logger.log("Payment reconciliation scheduler initialized");
  }

  async scanAndEnqueueStalePayments(): Promise<number> {
    const threshold = new Date(Date.now() - STALE_PAYMENT_THRESHOLD_MS);

    const staleOrders = await this.db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        tenantId: orders.tenantId,
        paymentExternalId: orders.paymentExternalId,
      })
      .from(orders)
      .where(
        and(
          eq(orders.paymentStatus, "pending"),
          lt(orders.createdAt, threshold),
        ),
      )
      .limit(100);

    for (const order of staleOrders) {
      if (!order.paymentExternalId) continue;

      const payload: PaymentReconciliationJobPayload = {
        orderId: order.id,
        orderNumber: order.orderNumber,
        tenantId: order.tenantId,
        paymentExternalId: order.paymentExternalId,
        attempt: 1,
      };

      await this.reconciliationQueue.add("reconcile-payment", payload, {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      });
    }

    if (staleOrders.length > 0) {
      this.logger.log(`Enqueued ${staleOrders.length} stale payments for reconciliation`);
    }

    return staleOrders.length;
  }
}

@Processor(PAYMENT_RECONCILIATION_QUEUE_NAME)
export class PaymentReconciliationScanner extends WorkerHost {
  private readonly logger = new Logger(PaymentReconciliationScanner.name);

  constructor(private readonly scheduler: PaymentReconciliationScheduler) {
    super();
  }

  async process(job: Job): Promise<{ scanned: number }> {
    if (job.name === "scan-stale-payments") {
      const scanned = await this.scheduler.scanAndEnqueueStalePayments();
      return { scanned };
    }
    return { scanned: 0 };
  }
}
