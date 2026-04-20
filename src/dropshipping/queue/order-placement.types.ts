import type {
  DropshippingFulfillmentStatus,
  DropshippingOrderTicket,
  SupplierOrderFailureKind,
  SupplierOrderRequest,
  SupplierOrderResult,
  SupplierShippingAddress,
} from "@gaqno-development/types";

export interface DropshippingOrderSnapshot {
  readonly orderId: string;
  readonly tenantId: string;
  readonly providerCode: string;
  readonly externalProductId: string;
  readonly externalVariationId?: string;
  readonly quantity: number;
  readonly buyerTaxNumber: string;
  readonly shippingAddress: SupplierShippingAddress;
  readonly referenceId: string;
  readonly fulfillmentStatus: DropshippingFulfillmentStatus;
}

export interface OrderPlacementRepositoryPort {
  findSnapshot(
    orderId: string,
    tenantId: string,
  ): Promise<DropshippingOrderSnapshot | undefined>;
  markPlacing(orderId: string, tenantId: string): Promise<void>;
  markPlaced(
    orderId: string,
    tenantId: string,
    result: SupplierOrderResult,
  ): Promise<void>;
  markOnHold(
    orderId: string,
    tenantId: string,
    reason: string,
  ): Promise<void>;
}

export interface DropshippingTicketRepositoryPort {
  openOrUpdate(
    input: OpenTicketInput,
  ): Promise<DropshippingOrderTicket>;
  markResolved(
    ticketId: string,
    tenantId: string,
    notes?: string,
  ): Promise<DropshippingOrderTicket>;
  markCancelled(
    ticketId: string,
    tenantId: string,
    reason: string,
  ): Promise<DropshippingOrderTicket>;
  findByOrder(
    orderId: string,
    tenantId: string,
  ): Promise<DropshippingOrderTicket | undefined>;
}

export interface OpenTicketInput {
  readonly tenantId: string;
  readonly orderId: string;
  readonly providerCode: string;
  readonly failureReason: string;
  readonly failureKind: SupplierOrderFailureKind;
}

export const ORDER_PLACEMENT_REPOSITORY = Symbol("ORDER_PLACEMENT_REPOSITORY");
export const DROPSHIPPING_TICKET_REPOSITORY = Symbol(
  "DROPSHIPPING_TICKET_REPOSITORY",
);

export const TRANSIENT_FAILURE_KINDS: readonly SupplierOrderFailureKind[] = [
  "transient",
  "unknown",
];

export function isTransientFailure(kind: SupplierOrderFailureKind): boolean {
  return TRANSIENT_FAILURE_KINDS.includes(kind);
}

export function buildSupplierRequest(
  snapshot: DropshippingOrderSnapshot,
): SupplierOrderRequest {
  return {
    externalProductId: snapshot.externalProductId,
    externalVariationId: snapshot.externalVariationId,
    quantity: snapshot.quantity,
    shippingAddress: snapshot.shippingAddress,
    buyerTaxNumber: snapshot.buyerTaxNumber,
    referenceId: snapshot.referenceId,
  };
}
