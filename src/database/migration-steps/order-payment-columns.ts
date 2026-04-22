import type { SqlClient } from "./enums";

export async function applyOrderPaymentColumns(sql: SqlClient): Promise<void> {
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS pix_expires_at TIMESTAMP`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_provider payment_provider`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_gateway_id UUID REFERENCES tenant_payment_gateways(id) ON DELETE SET NULL`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_idempotency_key VARCHAR(120)`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_failure_reason TEXT`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS webhook_last_received_at TIMESTAMP`;

  await sql`CREATE INDEX IF NOT EXISTS orders_payment_external_id_idx ON orders(tenant_id, payment_external_id)`;
  await sql`CREATE INDEX IF NOT EXISTS orders_pix_expires_idx ON orders(tenant_id, pix_expires_at) WHERE payment_status = 'pending'`;
}
