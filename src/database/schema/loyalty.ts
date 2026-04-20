import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  decimal,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenant";
import { customers } from "./customer";
import { orders } from "./order";

export const customerPoints = pgTable(
  "customer_points",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    balance: integer("balance").notNull().default(0),
    lifetimeEarned: integer("lifetime_earned").notNull().default(0),
    lifetimeRedeemed: integer("lifetime_redeemed").notNull().default(0),
    tier: varchar("tier", { length: 20 }).default("bronze"),
    tierExpiresAt: timestamp("tier_expires_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: index("customer_points_tenant_idx").on(table.tenantId),
    customerIdx: uniqueIndex("customer_points_customer_idx").on(
      table.tenantId,
      table.customerId,
    ),
  }),
);

export const pointsTransactions = pgTable(
  "points_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    type: varchar("type", { length: 20 }).notNull(),
    amount: integer("amount").notNull(),
    description: varchar("description", { length: 255 }),
    referenceId: varchar("reference_id", { length: 100 }),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: index("points_transactions_tenant_idx").on(table.tenantId),
    customerIdx: index("points_transactions_customer_idx").on(table.customerId),
    orderIdx: index("points_transactions_order_idx").on(table.orderId),
    createdAtIdx: index("points_transactions_created_idx").on(table.createdAt),
  }),
);

export const pointsRedemptionHistory = pgTable(
  "points_redemption_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    pointsRedeemed: integer("points_redeemed").notNull(),
    discountReceived: decimal("discount_received", {
      precision: 10,
      scale: 2,
    }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: index("points_redemption_tenant_idx").on(table.tenantId),
    customerIdx: index("points_redemption_customer_idx").on(table.customerId),
  }),
);

export const customerTierRules = pgTable(
  "customer_tier_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    tier: varchar("tier", { length: 20 }).notNull(),
    minPoints: integer("min_points").notNull(),
    pointsMultiplier: decimal("points_multiplier", {
      precision: 3,
      scale: 2,
    }).default("1.00"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: index("tier_rules_tenant_idx").on(table.tenantId),
    tierIdx: index("tier_rules_tier_idx").on(table.tenantId, table.tier),
  }),
);

export type CustomerPoints = typeof customerPoints.$inferSelect;
export type NewCustomerPoints = typeof customerPoints.$inferInsert;
export type PointsTransaction = typeof pointsTransactions.$inferSelect;
export type NewPointsTransaction = typeof pointsTransactions.$inferInsert;
export type PointsRedemptionHistory =
  typeof pointsRedemptionHistory.$inferSelect;
export type NewPointsRedemptionHistory =
  typeof pointsRedemptionHistory.$inferInsert;
export type CustomerTierRule = typeof customerTierRules.$inferSelect;
export type NewCustomerTierRule = typeof customerTierRules.$inferInsert;
