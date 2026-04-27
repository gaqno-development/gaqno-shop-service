export const ORDER_LIFECYCLE_PLUGIN = "ORDER_LIFECYCLE_PLUGIN";

export interface OrderItemForLifecycle {
  readonly productId: string;
  readonly quantity: number;
}

export interface LeadDayValidationRequest {
  readonly tenantId: string;
  readonly deliveryDate: Date;
  readonly items: readonly OrderItemForLifecycle[];
  readonly fallbackLeadDays?: number;
}

export interface StatusChangeContext {
  readonly tenantId: string;
  readonly orderId: string;
  readonly previous: string;
  readonly next: string;
  readonly items: readonly OrderItemForLifecycle[];
}

export interface OrderLifecyclePlugin {
  validateLeadDaysForOrder(request: LeadDayValidationRequest): Promise<void>;
  assertTransition(previous: string, next: string): void;
  handleStatusChange(context: StatusChangeContext): Promise<void>;
  describeDecorationReview(next: string): boolean;
}
