import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  decimal,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenant";
import { customers } from "./customer";
import { products, productVariations } from "./catalog";
import {
  orderStatusEnum,
  paymentStatusEnum,
  paymentMethodEnum,
} from "./enums";

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id),
    orderNumber: varchar("order_number", { length: 50 }).notNull(),
    status: orderStatusEnum("status").default("pending"),
    paymentStatus: paymentStatusEnum("payment_status").default("pending"),
    paymentMethod: paymentMethodEnum("payment_method"),
    paymentExternalId: varchar("payment_external_id", { length: 255 }),
    paymentExternalUrl: varchar("payment_external_url", { length: 500 }),
    pixQrCode: text("pix_qr_code"),
    pixQrCodeBase64: text("pix_qr_code_base64"),
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
    discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0"),
    shippingAmount: decimal("shipping_amount", { precision: 10, scale: 2 }).default("0"),
    total: decimal("total", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("BRL"),
    notes: text("notes"),
    customerNotes: text("customer_notes"),
    shippingAddress: jsonb("shipping_address").notNull(),
    billingAddress: jsonb("billing_address"),
    metadata: jsonb("metadata").default({}),
    fulfillmentType: varchar("fulfillment_type", { length: 20 }).default("own"),
    fulfillmentStatus: varchar("fulfillment_status", { length: 30 }),
    supplierOrderId: varchar("supplier_order_id", { length: 100 }),
    supplierProviderCode: varchar("supplier_provider_code", { length: 40 }),
    supplierTrackingCode: varchar("supplier_tracking_code", { length: 100 }),
    supplierTrackingUrl: varchar("supplier_tracking_url", { length: 500 }),
    onHoldReason: text("on_hold_reason"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    paidAt: timestamp("paid_at"),
    shippedAt: timestamp("shipped_at"),
    deliveredAt: timestamp("delivered_at"),
    cancelledAt: timestamp("cancelled_at"),
  },
  (table) => ({
    tenantIdx: index("orders_tenant_idx").on(table.tenantId),
    customerIdx: index("orders_customer_idx").on(table.customerId),
    orderNumberIdx: uniqueIndex("orders_tenant_number_idx").on(
      table.tenantId,
      table.orderNumber,
    ),
    statusIdx: index("orders_status_idx").on(table.status),
    createdAtIdx: index("orders_created_at_idx").on(table.createdAt),
  }),
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id),
    variationId: uuid("variation_id").references(() => productVariations.id),
    name: varchar("name", { length: 255 }).notNull(),
    sku: varchar("sku", { length: 100 }),
    quantity: integer("quantity").notNull(),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    total: decimal("total", { precision: 10, scale: 2 }).notNull(),
    attributes: jsonb("attributes").default({}),
    imageUrl: varchar("image_url", { length: 500 }),
    referenceImageUrl: varchar("reference_image_url", { length: 500 }),
    size: varchar("size", { length: 100 }),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: index("order_items_tenant_idx").on(table.tenantId),
    orderIdx: index("order_items_order_idx").on(table.orderId),
  }),
);

export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: orderStatusEnum("status").notNull(),
    notes: text("notes"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: index("status_history_tenant_idx").on(table.tenantId),
    orderIdx: index("status_history_order_idx").on(table.orderId),
  }),
);

export const carts = pgTable(
  "carts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id),
    sessionId: varchar("session_id", { length: 255 }),
    items: jsonb("items").default([]),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: index("carts_tenant_idx").on(table.tenantId),
    customerIdx: index("carts_customer_idx").on(table.customerId),
    sessionIdx: index("carts_session_idx").on(table.sessionId),
  }),
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderStatusHistory = typeof orderStatusHistory.$inferSelect;
export type Cart = typeof carts.$inferSelect;
