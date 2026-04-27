import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { PaymentReconciliationService } from "./payment-reconciliation.service";
import type { PaymentReconciliationJobPayload } from "./payment-reconciliation.types";

const PAYMENT_RECONCILIATION_QUEUE_NAME = "payment-reconciliation";

@Processor(PAYMENT_RECONCILIATION_QUEUE_NAME)
export class PaymentReconciliationProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentReconciliationProcessor.name);

  constructor(private readonly reconciliation: PaymentReconciliationService) {
    super();
  }

  async process(
    job: Job<PaymentReconciliationJobPayload>,
  ): Promise<{ status: string; orderNumber: string }> {
    const payload: PaymentReconciliationJobPayload = {
      ...job.data,
      attempt: job.attemptsMade + 1,
    };
    this.logger.log(
      `[${PAYMENT_RECONCILIATION_QUEUE_NAME}] order=${payload.orderNumber} attempt=${payload.attempt}`,
    );
    return this.reconciliation.reconcile(payload);
  }
}
