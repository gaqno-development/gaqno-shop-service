import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  decimal,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenant";

export const shippingMethods = pgTable(
  "shipping_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 50 }).notNull(),
    carrier: varchar("carrier", { length: 50 }).notNull(),
    serviceCode: varchar("service_code", { length: 50 }),
    isActive: boolean("is_active").default(true),
    isDefault: boolean("is_default").default(false),
    freeShippingThreshold: decimal("free_shipping_threshold", {
      precision: 10,
      scale: 2,
    }),
    flatRate: decimal("flat_rate", { precision: 10, scale: 2 }),
    handlingDays: integer("handling_days").default(1),
    estimatedDeliveryDaysMin: integer("estimated_delivery_days_min"),
    estimatedDeliveryDaysMax: integer("estimated_delivery_days_max"),
    settings: jsonb("settings").default({}),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: index("shipping_methods_tenant_idx").on(table.tenantId),
    tenantSlugIdx: uniqueIndex("shipping_methods_tenant_slug_idx").on(
      table.tenantId,
      table.slug,
    ),
  }),
);

export const shippingRatesCache = pgTable(
  "shipping_rates_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    cacheKey: varchar("cache_key", { length: 255 }).notNull(),
    cep: varchar("cep", { length: 9 }).notNull(),
    productIds: jsonb("product_ids").notNull(),
    rates: jsonb("rates").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: index("shipping_cache_tenant_idx").on(table.tenantId),
    cacheKeyIdx: uniqueIndex("shipping_cache_key_idx").on(
      table.tenantId,
      table.cacheKey,
    ),
    expiresAtIdx: index("shipping_cache_expires_idx").on(table.expiresAt),
  }),
);

export type ShippingMethod = typeof shippingMethods.$inferSelect;
export type NewShippingMethod = typeof shippingMethods.$inferInsert;
export type ShippingRatesCache = typeof shippingRatesCache.$inferSelect;
