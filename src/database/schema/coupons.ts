import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  decimal,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenant";

export const COUPON_TYPES = ["percentage", "fixed"] as const;
export type CouponType = (typeof COUPON_TYPES)[number];

export const coupons = pgTable(
  "coupons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 50 }).notNull(),
    type: varchar("type", { length: 20 }).notNull(),
    value: decimal("value", { precision: 10, scale: 2 }).notNull(),
    minOrder: decimal("min_order", { precision: 10, scale: 2 }),
    maxUses: integer("max_uses"),
    usedCount: integer("used_count").notNull().default(0),
    validFrom: timestamp("valid_from").notNull(),
    validUntil: timestamp("valid_until").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    tenantIdx: index("coupons_tenant_idx").on(table.tenantId),
    tenantCodeIdx: uniqueIndex("coupons_tenant_code_idx").on(
      table.tenantId,
      table.code,
    ),
    activeIdx: index("coupons_active_idx").on(table.tenantId, table.isActive),
  }),
);

export type Coupon = typeof coupons.$inferSelect;
export type NewCoupon = typeof coupons.$inferInsert;
