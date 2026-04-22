import {
  pgEnum,
} from "drizzle-orm/pg-core";

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "confirmed",
  "awaiting_decoration_review",
  "decoration_approved",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "approved",
  "authorized",
  "in_process",
  "in_mediation",
  "rejected",
  "cancelled",
  "refunded",
  "charged_back",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "credit_card",
  "debit_card",
  "pix",
  "boleto",
  "wallet",
]);

export const paymentProviderEnum = pgEnum("payment_provider", [
  "mercado_pago",
  "stripe",
  "pagseguro",
]);
