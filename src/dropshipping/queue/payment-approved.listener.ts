import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { DropshippingQueueProducer } from "./dropshipping-queue.producer";
import {
  PAYMENT_APPROVED_EVENT,
  type PaymentApprovedEvent,
} from "./payment-approved.event";

@Injectable()
export class PaymentApprovedListener {
  private readonly logger = new Logger(PaymentApprovedListener.name);

  constructor(private readonly producer: DropshippingQueueProducer) {}

  @OnEvent(PAYMENT_APPROVED_EVENT)
  async handle(event: PaymentApprovedEvent): Promise<void> {
    if (!this.shouldEnqueue(event)) return;
    await this.producer.enqueue({
      orderId: event.orderId,
      tenantId: event.tenantId,
      providerCode: event.supplierProviderCode ?? "aliexpress",
      attempt: 1,
    });
    this.logger.log(
      `Enqueued dropshipping placement for order=${event.orderId}`,
    );
  }

  private shouldEnqueue(event: PaymentApprovedEvent): boolean {
    return event.fulfillmentType === "dropshipping";
  }
}
