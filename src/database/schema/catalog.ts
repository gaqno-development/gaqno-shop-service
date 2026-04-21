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
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenant";

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
    tenantSlugIdx: uniqueIndex("categories_tenant_slug_idx").on(
      table.tenantId,
      table.slug,
    ),
  }),
);

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
    sourceProvider: varchar("source_provider", { length: 40 }),
    sourceProductId: varchar("source_product_id", { length: 100 }),
    sourceVariationIds: jsonb("source_variation_ids").default({}),
    sourceCostAmount: decimal("source_cost_amount", {
      precision: 10,
      scale: 2,
    }),
    sourceCostCurrency: varchar("source_cost_currency", { length: 3 }),
    marginOverridePercent: decimal("margin_override_percent", {
      precision: 5,
      scale: 2,
    }),
    lastSyncedAt: timestamp("last_synced_at"),
    syncStatus: varchar("sync_status", { length: 20 }),
    allowsReferenceImage: boolean("allows_reference_image").default(false),
    leadDays: integer("lead_days"),
    recipeId: uuid("recipe_id"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: index("products_tenant_idx").on(table.tenantId),
    tenantSlugIdx: uniqueIndex("products_tenant_slug_idx").on(
      table.tenantId,
      table.slug,
    ),
    categoryIdx: index("products_category_idx").on(table.categoryId),
    activeIdx: index("products_active_idx").on(table.isActive),
    sourceIdx: index("products_source_idx").on(
      table.sourceProvider,
      table.sourceProductId,
    ),
  }),
);

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
  }),
);

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductVariation = typeof productVariations.$inferSelect;
