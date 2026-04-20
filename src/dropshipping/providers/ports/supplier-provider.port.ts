import type {
  SupplierCancelResult,
  SupplierOrderRequest,
  SupplierOrderResult,
  SupplierProductDetail,
  SupplierProviderCode,
  SupplierSearchQuery,
  SupplierSearchResult,
  SupplierTrackingUpdate,
} from "@gaqno-development/types";

export interface SupplierProviderPort {
  readonly code: SupplierProviderCode;

  search(query: SupplierSearchQuery): Promise<SupplierSearchResult>;

  getDetails(externalId: string): Promise<SupplierProductDetail>;

  placeOrder(request: SupplierOrderRequest): Promise<SupplierOrderResult>;

  getTracking(externalOrderId: string): Promise<SupplierTrackingUpdate>;

  cancelOrder(
    externalOrderId: string,
    reason: string,
  ): Promise<SupplierCancelResult>;
}
