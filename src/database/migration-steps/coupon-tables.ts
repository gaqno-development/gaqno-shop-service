import type { SqlClient } from "./enums";

export async function applyCouponTables(sql: SqlClient): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS coupons (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      code VARCHAR(50) NOT NULL,
      type VARCHAR(20) NOT NULL,
      value DECIMAL(10, 2) NOT NULL,
      min_order DECIMAL(10, 2),
      max_uses INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      valid_from TIMESTAMP NOT NULL,
      valid_until TIMESTAMP NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS coupons_tenant_idx ON coupons(tenant_id)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS coupons_tenant_code_idx ON coupons(tenant_id, code)`;
  await sql`CREATE INDEX IF NOT EXISTS coupons_active_idx ON coupons(tenant_id, is_active)`;
}
