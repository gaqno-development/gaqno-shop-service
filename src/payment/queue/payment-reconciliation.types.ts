export interface PaymentReconciliationJobPayload {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly tenantId: string;
  readonly paymentExternalId: string;
  readonly attempt: number;
}
