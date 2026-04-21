import {
  pgTable,
  pgEnum,
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
import { products } from "./catalog";
import { orders, orderItems } from "./order";

export const decorationTypeEnum = pgEnum("bakery_decoration_type", [
  "topping",
  "filling",
  "message",
  "theme",
  "extra",
]);

export const inventoryMovementTypeEnum = pgEnum("bakery_movement_type", [
  "in",
  "out",
  "adjustment",
]);

export const adminEventTypeEnum = pgEnum("bakery_event_type", [
  "stock_purchase",
  "production",
  "delivery",
  "custom",
]);

export const ingredients = pgTable(
  "bakery_ingredients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    unit: varchar("unit", { length: 20 }).notNull(),
    gramsPerUnit: decimal("grams_per_unit", { precision: 10, scale: 3 }),
    stock: decimal("stock", { precision: 10, scale: 3 }).notNull().default("0"),
    minStock: decimal("min_stock", { precision: 10, scale: 3 }).notNull().default("0"),
    costPerUnit: decimal("cost_per_unit", { precision: 10, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: index("bakery_ingredients_tenant_idx").on(table.tenantId),
    tenantNameIdx: uniqueIndex("bakery_ingredients_tenant_name_idx").on(
      table.tenantId,
      table.name,
    ),
  }),
);

export const recipes = pgTable(
  "bakery_recipes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    yieldQuantity: decimal("yield_quantity", { precision: 10, scale: 3 }).notNull().default("1"),
    yieldUnit: varchar("yield_unit", { length: 40 }).notNull().default("unidade"),
    laborCost: decimal("labor_cost", { precision: 10, scale: 2 }).notNull().default("0"),
    overheadCost: decimal("overhead_cost", { precision: 10, scale: 2 }).notNull().default("0"),
    profitMarginPercent: decimal("profit_margin_percent", { precision: 5, scale: 2 })
      .notNull()
      .default("50"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: index("bakery_recipes_tenant_idx").on(table.tenantId),
  }),
);

export const recipeIngredients = pgTable(
  "bakery_recipe_ingredients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    ingredientId: uuid("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "restrict" }),
    quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  },
  (table) => ({
    tenantIdx: index("bakery_recipe_ingredients_tenant_idx").on(table.tenantId),
    recipeIngIdx: uniqueIndex("bakery_recipe_ingredient_unique_idx").on(
      table.recipeId,
      table.ingredientId,
    ),
  }),
);

export const productIngredients = pgTable(
  "bakery_product_ingredients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    ingredientId: uuid("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "restrict" }),
    quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  },
  (table) => ({
    tenantIdx: index("bakery_product_ingredients_tenant_idx").on(table.tenantId),
    productIngIdx: uniqueIndex("bakery_product_ingredient_unique_idx").on(
      table.productId,
      table.ingredientId,
    ),
  }),
);

export const inventoryMovements = pgTable(
  "bakery_inventory_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    ingredientId: uuid("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "cascade" }),
    type: inventoryMovementTypeEnum("type").notNull(),
    quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
    reason: varchar("reason", { length: 255 }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: index("bakery_movements_tenant_idx").on(table.tenantId),
    ingredientIdx: index("bakery_movements_ingredient_idx").on(table.ingredientId),
    orderIdx: index("bakery_movements_order_idx").on(table.orderId),
  }),
);

export const decorations = pgTable(
  "bakery_decorations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0"),
    type: decorationTypeEnum("type").notNull(),
    imageUrl: varchar("image_url", { length: 500 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: index("bakery_decorations_tenant_idx").on(table.tenantId),
  }),
);

export const productDecorations = pgTable(
  "bakery_product_decorations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    decorationId: uuid("decoration_id")
      .notNull()
      .references(() => decorations.id, { onDelete: "cascade" }),
  },
  (table) => ({
    tenantIdx: index("bakery_product_decorations_tenant_idx").on(table.tenantId),
    uniqueIdx: uniqueIndex("bakery_product_decoration_unique_idx").on(
      table.productId,
      table.decorationId,
    ),
  }),
);

export const orderItemDecorations = pgTable(
  "bakery_order_item_decorations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    decorationId: uuid("decoration_id")
      .notNull()
      .references(() => decorations.id, { onDelete: "restrict" }),
    customText: varchar("custom_text", { length: 255 }),
    price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0"),
  },
  (table) => ({
    tenantIdx: index("bakery_order_item_decorations_tenant_idx").on(table.tenantId),
    orderItemIdx: index("bakery_order_item_decorations_item_idx").on(table.orderItemId),
  }),
);

export const productSizes = pgTable(
  "bakery_product_sizes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    priceModifier: decimal("price_modifier", { precision: 10, scale: 2 }).notNull().default("0"),
    servings: integer("servings"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => ({
    tenantIdx: index("bakery_product_sizes_tenant_idx").on(table.tenantId),
    productIdx: index("bakery_product_sizes_product_idx").on(table.productId),
  }),
);

export const adminEvents = pgTable(
  "bakery_admin_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    type: adminEventTypeEnum("type").notNull(),
    date: timestamp("date").notNull(),
    endDate: timestamp("end_date"),
    allDay: boolean("all_day").notNull().default(true),
    color: varchar("color", { length: 20 }),
    completed: boolean("completed").notNull().default(false),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: index("bakery_admin_events_tenant_idx").on(table.tenantId),
    dateIdx: index("bakery_admin_events_date_idx").on(table.date),
    orderIdx: index("bakery_admin_events_order_idx").on(table.orderId),
  }),
);

export const siteSettings = pgTable(
  "bakery_site_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    storeName: varchar("store_name", { length: 255 }).notNull().default(""),
    paymentDescriptor: varchar("payment_descriptor", { length: 100 }).notNull().default(""),
    heroTitle: varchar("hero_title", { length: 255 }).notNull().default(""),
    heroSubtitle: varchar("hero_subtitle", { length: 500 }).notNull().default(""),
    heroImageUrl: varchar("hero_image_url", { length: 500 }),
    introTitle: varchar("intro_title", { length: 255 }).notNull().default(""),
    introText: text("intro_text").notNull().default(""),
    whatsappNumber: varchar("whatsapp_number", { length: 30 }).notNull().default(""),
    instagramUrl: varchar("instagram_url", { length: 255 }).notNull().default(""),
    metadata: jsonb("metadata").default({}),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: uniqueIndex("bakery_site_settings_tenant_idx").on(table.tenantId),
  }),
);

export type Ingredient = typeof ingredients.$inferSelect;
export type NewIngredient = typeof ingredients.$inferInsert;
export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type RecipeIngredient = typeof recipeIngredients.$inferSelect;
export type NewRecipeIngredient = typeof recipeIngredients.$inferInsert;
export type ProductIngredient = typeof productIngredients.$inferSelect;
export type NewProductIngredient = typeof productIngredients.$inferInsert;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type NewInventoryMovement = typeof inventoryMovements.$inferInsert;
export type Decoration = typeof decorations.$inferSelect;
export type NewDecoration = typeof decorations.$inferInsert;
export type ProductDecoration = typeof productDecorations.$inferSelect;
export type OrderItemDecoration = typeof orderItemDecorations.$inferSelect;
export type NewOrderItemDecoration = typeof orderItemDecorations.$inferInsert;
export type ProductSize = typeof productSizes.$inferSelect;
export type NewProductSize = typeof productSizes.$inferInsert;
export type AdminEvent = typeof adminEvents.$inferSelect;
export type NewAdminEvent = typeof adminEvents.$inferInsert;
export type SiteSettings = typeof siteSettings.$inferSelect;
export type NewSiteSettings = typeof siteSettings.$inferInsert;
