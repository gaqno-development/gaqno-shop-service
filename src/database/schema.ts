import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  decimal,
  integer,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Enums
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "confirmed",
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

// Tenants table
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
  })
);

// Feature flags per tenant
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
  })
);

// Categories
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    description: text("description"),
    imageUrl: varchar("image_url", { length: 500 }),
    sortOrder: integer("sort_order").default(0),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: index("categories_tenant_idx").on(table.tenantId),
    tenantSlugIdx: uniqueIndex("categories_tenant_slug_idx").on(table.tenantId, table.slug),
  })
);

// Products
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    description: text("description"),
    shortDescription: varchar("short_description", { length: 500 }),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    compareAtPrice: decimal("compare_at_price", { precision: 10, scale: 2 }),
    costPrice: decimal("cost_price", { precision: 10, scale: 2 }),
    sku: varchar("sku", { length: 100 }),
    barcode: varchar("barcode", { length: 100 }),
    weight: decimal("weight", { precision: 8, scale: 2 }),
    inventoryQuantity: integer("inventory_quantity").default(0),
    inventoryTracked: boolean("inventory_tracked").default(false),
    allowBackorders: boolean("allow_backorders").default(false),
    images: jsonb("images").default([]),
    tags: jsonb("tags").default([]),
    attributes: jsonb("attributes").default({}),
    seoTitle: varchar("seo_title", { length: 255 }),
    seoDescription: varchar("seo_description", { length: 500 }),
    isActive: boolean("is_active").default(true),
    isFeatured: boolean("is_featured").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: index("products_tenant_idx").on(table.tenantId),
    tenantSlugIdx: uniqueIndex("products_tenant_slug_idx").on(table.tenantId, table.slug),
    categoryIdx: index("products_category_idx").on(table.categoryId),
    activeIdx: index("products_active_idx").on(table.isActive),
  })
);

// Product variations
export const productVariations = pgTable(
  "product_variations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    sku: varchar("sku", { length: 100 }),
    price: decimal("price", { precision: 10, scale: 2 }),
    inventoryQuantity: integer("inventory_quantity").default(0),
    options: jsonb("options").notNull(),
    imageUrl: varchar("image_url", { length: 500 }),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: index("variations_tenant_idx").on(table.tenantId),
    productIdx: index("variations_product_idx").on(table.productId),
  })
);

// Customers
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    password: varchar("password", { length: 255 }),
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    phone: varchar("phone", { length: 20 }),
    cpf: varchar("cpf", { length: 14 }),
    birthDate: timestamp("birth_date"),
    isEmailVerified: boolean("is_email_verified").default(false),
    isActive: boolean("is_active").default(true),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: index("customers_tenant_idx").on(table.tenantId),
    emailIdx: index("customers_email_idx").on(table.email),
    tenantEmailIdx: uniqueIndex("customers_tenant_email_idx").on(table.tenantId, table.email),
  })
);

// Customer addresses
export const customerAddresses = pgTable(
  "customer_addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }),
    cep: varchar("cep", { length: 9 }).notNull(),
    street: varchar("street", { length: 255 }).notNull(),
    number: varchar("number", { length: 20 }).notNull(),
    complement: varchar("complement", { length: 100 }),
    neighborhood: varchar("neighborhood", { length: 100 }).notNull(),
    city: varchar("city", { length: 100 }).notNull(),
    state: varchar("state", { length: 2 }).notNull(),
    isDefault: boolean("is_default").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: index("addresses_tenant_idx").on(table.tenantId),
    customerIdx: index("addresses_customer_idx").on(table.customerId),
  })
);

// Orders
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
    orderNumberIdx: uniqueIndex("orders_tenant_number_idx").on(table.tenantId, table.orderNumber),
    statusIdx: index("orders_status_idx").on(table.status),
    createdAtIdx: index("orders_created_at_idx").on(table.createdAt),
  })
);

// Order items
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
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: index("order_items_tenant_idx").on(table.tenantId),
    orderIdx: index("order_items_order_idx").on(table.orderId),
  })
);

// Order status history
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
  })
);

// Carts (for guest and logged-in users)
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
  })
);

// Type exports
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type TenantFeatureFlags = typeof tenantFeatureFlags.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductVariation = typeof productVariations.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type CustomerAddress = typeof customerAddresses.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type Cart = typeof carts.$inferSelect;
