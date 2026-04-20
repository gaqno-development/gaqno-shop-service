import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 50 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    domain: varchar("domain", { length: 255 }).unique(),
    description: text("description"),
    primaryColor: varchar("primary_color", { length: 7 }).default("#e11d48"),
    bgColor: varchar("bg_color", { length: 7 }).default("#ffffff"),
    secondaryColor: varchar("secondary_color", { length: 7 }).default("#f9a8d4"),
    logoUrl: varchar("logo_url", { length: 500 }),
    faviconUrl: varchar("favicon_url", { length: 500 }),
    isActive: boolean("is_active").default(true),
    isDropshipping: boolean("is_dropshipping").default(false),
    orderPrefix: varchar("order_prefix", { length: 10 }).default("ORD"),
    mercadoPagoAccessToken: varchar("mercado_pago_access_token", { length: 500 }),
    mercadoPagoPublicKey: varchar("mercado_pago_public_key", { length: 500 }),
    mercadoPagoWebhookSecret: varchar("mercado_pago_webhook_secret", { length: 500 }),
    settings: jsonb("settings").default({}),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    slugIdx: index("tenants_slug_idx").on(table.slug),
    domainIdx: uniqueIndex("tenants_domain_idx").on(table.domain),
  }),
);

export const tenantFeatureFlags = pgTable(
  "tenant_feature_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    featureShipping: boolean("feature_shipping").default(true),
    featureDecorations: boolean("feature_decorations").default(true),
    featureCoupons: boolean("feature_coupons").default(true),
    featureRecipes: boolean("feature_recipes").default(false),
    featureInventory: boolean("feature_inventory").default(true),
    featureCheckoutPro: boolean("feature_checkout_pro").default(true),
    featurePix: boolean("feature_pix").default(true),
    featureDropshipping: boolean("feature_dropshipping").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: uniqueIndex("feature_flags_tenant_idx").on(table.tenantId),
  }),
);

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type TenantFeatureFlags = typeof tenantFeatureFlags.$inferSelect;
