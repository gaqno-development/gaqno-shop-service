import type { SqlClient } from "./enums";

export async function applyTenantColumns(sql: SqlClient): Promise<void> {
  await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS vertical VARCHAR(20) DEFAULT 'generic'`;
  await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS layout_hint VARCHAR(50) DEFAULT 'generic-grid'`;
  await sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS terminology_key VARCHAR(50) DEFAULT 'generic'`;

  await sql`ALTER TABLE tenant_feature_flags ADD COLUMN IF NOT EXISTS feature_bakery BOOLEAN DEFAULT false`;

  await sql`ALTER TABLE tenant_feature_flags ADD COLUMN IF NOT EXISTS feature_credit_card BOOLEAN`;
  await sql`ALTER TABLE tenant_feature_flags ADD COLUMN IF NOT EXISTS feature_boleto BOOLEAN`;
  await sql`
    UPDATE tenant_feature_flags
    SET
      feature_credit_card = COALESCE(feature_checkout_pro, true),
      feature_boleto = COALESCE(feature_checkout_pro, true)
    WHERE feature_credit_card IS NULL OR feature_boleto IS NULL
  `;
  await sql`ALTER TABLE tenant_feature_flags ALTER COLUMN feature_credit_card SET DEFAULT true`;
  await sql`ALTER TABLE tenant_feature_flags ALTER COLUMN feature_boleto SET DEFAULT true`;
  await sql`ALTER TABLE tenant_feature_flags ALTER COLUMN feature_credit_card SET NOT NULL`;
  await sql`ALTER TABLE tenant_feature_flags ALTER COLUMN feature_boleto SET NOT NULL`;

  await sql.unsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_provider') THEN
        CREATE TYPE payment_provider AS ENUM ('mercado_pago', 'stripe', 'pagseguro');
      END IF;
    END $$;
  `);

  await sql`
    CREATE TABLE IF NOT EXISTS tenant_payment_gateways (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      provider payment_provider NOT NULL,
      credentials JSONB DEFAULT '{}',
      is_active BOOLEAN DEFAULT false,
      is_default BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS tenant_payment_gateways_tenant_provider_unique ON tenant_payment_gateways(tenant_id, provider)`;
  await sql`CREATE INDEX IF NOT EXISTS tenant_payment_gateways_tenant_idx ON tenant_payment_gateways(tenant_id)`;
}
