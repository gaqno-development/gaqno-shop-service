export type TargetOrderStatus =
  | "pending"
  | "confirmed"
  | "awaiting_decoration_review"
  | "decoration_approved"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export type TargetPaymentStatus =
  | "pending"
  | "approved"
  | "authorized"
  | "in_process"
  | "in_mediation"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back";

export type TargetPaymentMethod =
  | "credit_card"
  | "debit_card"
  | "pix"
  | "boleto"
  | "wallet";

export type TargetDecorationType =
  | "topping"
  | "filling"
  | "message"
  | "theme"
  | "extra";

export type TargetCouponType = "percentage" | "fixed";

export type TargetMovementType = "in" | "out" | "adjustment";

export type TargetAdminEventType =
  | "stock_purchase"
  | "production"
  | "delivery"
  | "custom";

const ORDER_STATUS_MAP: Readonly<Record<string, TargetOrderStatus>> = {
  AWAITING_PAYMENT: "pending",
  PAID: "confirmed",
  AWAITING_DECORATION_REVIEW: "awaiting_decoration_review",
  DECORATION_APPROVED: "decoration_approved",
  PREPARING: "processing",
  READY: "processing",
  OUT_FOR_DELIVERY: "shipped",
  COMPLETED: "delivered",
  CANCELLED: "cancelled",
};

const PAYMENT_STATUS_MAP: Readonly<Record<string, TargetPaymentStatus>> = {
  AWAITING_PAYMENT: "pending",
  CONFIRMED: "approved",
  REFUNDED: "refunded",
};

const PAYMENT_METHOD_MAP: Readonly<Record<string, TargetPaymentMethod>> = {
  PIX: "pix",
  CHECKOUT_PRO: "credit_card",
};

const DECORATION_TYPE_MAP: Readonly<Record<string, TargetDecorationType>> = {
  TOPPING: "topping",
  FILLING: "filling",
  MESSAGE: "message",
  THEME: "theme",
  EXTRA: "extra",
};

const COUPON_TYPE_MAP: Readonly<Record<string, TargetCouponType>> = {
  PERCENTAGE: "percentage",
  FIXED: "fixed",
};

const MOVEMENT_TYPE_MAP: Readonly<Record<string, TargetMovementType>> = {
  IN: "in",
  OUT: "out",
  ADJUSTMENT: "adjustment",
};

const ADMIN_EVENT_TYPE_MAP: Readonly<Record<string, TargetAdminEventType>> = {
  STOCK_PURCHASE: "stock_purchase",
  PRODUCTION: "production",
  DELIVERY: "delivery",
  CUSTOM: "custom",
};

function lookup<T>(
  table: Readonly<Record<string, T>>,
  value: string,
  enumName: string,
): T {
  const mapped = table[value];
  if (mapped === undefined) {
    throw new Error(`Unmapped fifia ${enumName}: ${value}`);
  }
  return mapped;
}

export function mapOrderStatus(value: string): TargetOrderStatus {
  return lookup(ORDER_STATUS_MAP, value, "OrderStatus");
}

export function mapPaymentStatus(value: string): TargetPaymentStatus {
  return lookup(PAYMENT_STATUS_MAP, value, "PaymentStatus");
}

export function mapPaymentMethod(value: string): TargetPaymentMethod {
  return lookup(PAYMENT_METHOD_MAP, value, "PaymentMethod");
}

export function mapDecorationType(value: string): TargetDecorationType {
  return lookup(DECORATION_TYPE_MAP, value, "DecorationType");
}

export function mapCouponType(value: string): TargetCouponType {
  return lookup(COUPON_TYPE_MAP, value, "CouponType");
}

export function mapMovementType(value: string): TargetMovementType {
  return lookup(MOVEMENT_TYPE_MAP, value, "MovementType");
}

export function mapAdminEventType(value: string): TargetAdminEventType {
  return lookup(ADMIN_EVENT_TYPE_MAP, value, "EventType");
}

export function mapRoleToCustomer(role: string): boolean {
  return role === "CUSTOMER";
}
