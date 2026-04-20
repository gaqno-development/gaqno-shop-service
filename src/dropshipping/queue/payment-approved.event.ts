export const PAYMENT_APPROVED_EVENT = "shop.payment.approved" as const;

export interface PaymentApprovedEvent {
  readonly tenantId: string;
  readonly orderId: string;
  readonly fulfillmentType?: string;
  readonly supplierProviderCode?: string;
  readonly occurredAt: string;
}
