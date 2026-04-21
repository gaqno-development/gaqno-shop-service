import type { SqlClient } from "./enums";

export async function applyLoyaltyTables(sql: SqlClient): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS customer_points (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      balance INTEGER NOT NULL DEFAULT 0,
      lifetime_earned INTEGER NOT NULL DEFAULT 0,
      lifetime_redeemed INTEGER NOT NULL DEFAULT 0,
      tier VARCHAR(20) DEFAULT 'bronze',
      tier_expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS customer_points_tenant_idx ON customer_points(tenant_id)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS customer_points_customer_idx ON customer_points(tenant_id, customer_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS points_transactions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
      type VARCHAR(20) NOT NULL,
      amount INTEGER NOT NULL,
      description VARCHAR(255),
      reference_id VARCHAR(100),
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS points_transactions_tenant_idx ON points_transactions(tenant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS points_transactions_customer_idx ON points_transactions(customer_id)`;
  await sql`CREATE INDEX IF NOT EXISTS points_transactions_order_idx ON points_transactions(order_id)`;
  await sql`CREATE INDEX IF NOT EXISTS points_transactions_created_idx ON points_transactions(created_at)`;

  await sql`
    CREATE TABLE IF NOT EXISTS points_redemption_history (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
      points_redeemed INTEGER NOT NULL,
      discount_received DECIMAL(10, 2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS points_redemption_tenant_idx ON points_redemption_history(tenant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS points_redemption_customer_idx ON points_redemption_history(customer_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS customer_tier_rules (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      tier VARCHAR(20) NOT NULL,
      min_points INTEGER NOT NULL,
      points_multiplier DECIMAL(3, 2) DEFAULT 1.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS tier_rules_tenant_idx ON customer_tier_rules(tenant_id)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS tier_rules_tier_idx ON customer_tier_rules(tenant_id, tier)`;
}
