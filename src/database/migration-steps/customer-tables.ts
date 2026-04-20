import type { SqlClient } from "./enums";

export async function createCustomerTables(sql: SqlClient): Promise<void> {
  await sql`
    CREATE TABLE customers (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      email VARCHAR(255) NOT NULL,
      password VARCHAR(255),
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      phone VARCHAR(20),
      cpf VARCHAR(14),
      birth_date TIMESTAMP,
      is_email_verified BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX customers_tenant_idx ON customers(tenant_id)`;
  await sql`CREATE INDEX customers_email_idx ON customers(email)`;
  await sql`CREATE UNIQUE INDEX customers_tenant_email_idx ON customers(tenant_id, email)`;

  await sql`
    CREATE TABLE customer_addresses (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      name VARCHAR(100),
      cep VARCHAR(9) NOT NULL,
      street VARCHAR(255) NOT NULL,
      number VARCHAR(20) NOT NULL,
      complement VARCHAR(100),
      neighborhood VARCHAR(100) NOT NULL,
      city VARCHAR(100) NOT NULL,
      state VARCHAR(2) NOT NULL,
      is_default BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX addresses_tenant_idx ON customer_addresses(tenant_id)`;
  await sql`CREATE INDEX addresses_customer_idx ON customer_addresses(customer_id)`;
}
