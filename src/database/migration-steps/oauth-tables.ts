import type { SqlClient } from "./enums";

export async function applyOAuthAccountsTable(sql: SqlClient): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS customer_oauth_accounts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      provider VARCHAR(40) NOT NULL,
      provider_account_id VARCHAR(255) NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      id_token TEXT,
      expires_at TIMESTAMP,
      scope VARCHAR(500),
      token_type VARCHAR(40),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS oauth_accounts_tenant_idx ON customer_oauth_accounts(tenant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS oauth_accounts_customer_idx ON customer_oauth_accounts(customer_id)`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS oauth_accounts_provider_identity_idx
    ON customer_oauth_accounts(provider, provider_account_id)
  `;

  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500)`;
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP`;
}
