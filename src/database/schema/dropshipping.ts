import {
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenant";
import { orders } from "./order";

export const dropshippingProviders = pgTable(
  "dropshipping_providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    providerCode: varchar("provider_code", { length: 40 }).notNull(),
    credentialsEncrypted: text("credentials_encrypted"),
    isActive: boolean("is_active").default(true),
    defaultMarginPercent: decimal("default_margin_percent", {
      precision: 5,
      scale: 2,
    })
      .notNull()
      .default("80.00"),
    roundingRule: varchar("rounding_rule", { length: 20 }).default("none"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: index("dropshipping_providers_tenant_idx").on(table.tenantId),
    tenantProviderIdx: uniqueIndex("dropshipping_providers_unique_idx").on(
      table.tenantId,
      table.providerCode,
    ),
  }),
);

export const dropshippingFxRates = pgTable(
  "dropshipping_fx_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rateDate: varchar("rate_date", { length: 10 }).notNull(),
    currencyFrom: varchar("currency_from", { length: 3 }).notNull(),
    currencyTo: varchar("currency_to", { length: 3 }).notNull(),
    rate: decimal("rate", { precision: 12, scale: 6 }).notNull(),
    source: varchar("source", { length: 40 }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    uniqueRate: uniqueIndex("dropshipping_fx_rates_unique_idx").on(
      table.rateDate,
      table.currencyFrom,
      table.currencyTo,
    ),
  }),
);

export const dropshippingSyncLog = pgTable(
  "dropshipping_sync_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    providerCode: varchar("provider_code", { length: 40 }).notNull(),
    eventType: varchar("event_type", { length: 60 }).notNull(),
    payloadRequest: jsonb("payload_request").default({}),
    payloadResponse: jsonb("payload_response").default({}),
    success: boolean("success").notNull(),
    errorCode: varchar("error_code", { length: 60 }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: index("dropshipping_sync_log_tenant_idx").on(table.tenantId),
    orderIdx: index("dropshipping_sync_log_order_idx").on(table.orderId),
    eventIdx: index("dropshipping_sync_log_event_idx").on(table.eventType),
  }),
);

export const dropshippingOrderTickets = pgTable(
  "dropshipping_order_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    providerCode: varchar("provider_code", { length: 40 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("open"),
    failureReason: text("failure_reason").notNull(),
    failureKind: varchar("failure_kind", { length: 40 }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    resolutionNotes: text("resolution_notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => ({
    tenantIdx: index("dropshipping_tickets_tenant_idx").on(table.tenantId),
    orderIdx: index("dropshipping_tickets_order_idx").on(table.orderId),
    statusIdx: index("dropshipping_tickets_status_idx").on(table.status),
  }),
);

export type DropshippingProvider = typeof dropshippingProviders.$inferSelect;
export type NewDropshippingProvider = typeof dropshippingProviders.$inferInsert;
export type DropshippingFxRate = typeof dropshippingFxRates.$inferSelect;
export type NewDropshippingFxRate = typeof dropshippingFxRates.$inferInsert;
export type DropshippingSyncLog = typeof dropshippingSyncLog.$inferSelect;
export type NewDropshippingSyncLog = typeof dropshippingSyncLog.$inferInsert;
export type DropshippingOrderTicket =
  typeof dropshippingOrderTickets.$inferSelect;
export type NewDropshippingOrderTicket =
  typeof dropshippingOrderTickets.$inferInsert;
