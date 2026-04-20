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
import { tenants } from "./tenant";

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
    tenantEmailIdx: uniqueIndex("customers_tenant_email_idx").on(
      table.tenantId,
      table.email,
    ),
  }),
);

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
  }),
);

export const customerSessions = pgTable(
  "customer_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    lastUsedAt: timestamp("last_used_at").defaultNow(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
  },
  (table) => ({
    tenantIdx: index("sessions_tenant_idx").on(table.tenantId),
    customerIdx: index("sessions_customer_idx").on(table.customerId),
    tokenIdx: uniqueIndex("sessions_token_idx").on(table.token),
  }),
);

export const customerEmailVerifications = pgTable(
  "customer_email_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    usedAt: timestamp("used_at"),
  },
  (table) => ({
    tenantIdx: index("email_verif_tenant_idx").on(table.tenantId),
    tokenIdx: uniqueIndex("email_verif_token_idx").on(table.token),
  }),
);

export const customerPasswordResets = pgTable(
  "customer_password_resets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    usedAt: timestamp("used_at"),
  },
  (table) => ({
    tenantIdx: index("password_reset_tenant_idx").on(table.tenantId),
    tokenIdx: uniqueIndex("password_reset_token_idx").on(table.token),
  }),
);

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type CustomerAddress = typeof customerAddresses.$inferSelect;
export type CustomerSession = typeof customerSessions.$inferSelect;
export type CustomerEmailVerification =
  typeof customerEmailVerifications.$inferSelect;
export type CustomerPasswordReset = typeof customerPasswordResets.$inferSelect;
