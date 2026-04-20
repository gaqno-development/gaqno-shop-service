import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenant";
import { customers } from "./customer";
import { products } from "./catalog";

export const wishlists = pgTable(
  "wishlists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).default("Favoritos"),
    isPublic: boolean("is_public").default(false),
    shareToken: varchar("share_token", { length: 64 }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: index("wishlists_tenant_idx").on(table.tenantId),
    customerIdx: index("wishlists_customer_idx").on(table.customerId),
    shareTokenIdx: uniqueIndex("wishlists_share_token_idx").on(table.shareToken),
  }),
);

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    wishlistId: uuid("wishlist_id")
      .notNull()
      .references(() => wishlists.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    note: text("note"),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    wishlistIdx: index("wishlist_items_wishlist_idx").on(table.wishlistId),
    productIdx: index("wishlist_items_product_idx").on(table.productId),
    wishlistProductIdx: uniqueIndex("wishlist_items_unique_idx").on(
      table.wishlistId,
      table.productId,
    ),
  }),
);

export type Wishlist = typeof wishlists.$inferSelect;
export type NewWishlist = typeof wishlists.$inferInsert;
export type WishlistItem = typeof wishlistItems.$inferSelect;
export type NewWishlistItem = typeof wishlistItems.$inferInsert;
