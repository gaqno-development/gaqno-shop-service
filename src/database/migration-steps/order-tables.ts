import type { SqlClient } from "./enums";

export async function createOrderTables(sql: SqlClient): Promise<void> {
  await sql`
    CREATE TABLE orders (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      customer_id UUID REFERENCES customers(id),
      order_number VARCHAR(50) NOT NULL,
      status order_status DEFAULT 'pending',
      payment_status payment_status DEFAULT 'pending',
      payment_method payment_method,
      payment_external_id VARCHAR(255),
      payment_external_url VARCHAR(500),
      pix_qr_code TEXT,
      pix_qr_code_base64 TEXT,
      subtotal DECIMAL(10, 2) NOT NULL,
      discount_amount DECIMAL(10, 2) DEFAULT 0,
      shipping_amount DECIMAL(10, 2) DEFAULT 0,
      total DECIMAL(10, 2) NOT NULL,
      currency VARCHAR(3) DEFAULT 'BRL',
      notes TEXT,
      customer_notes TEXT,
      shipping_address JSONB NOT NULL,
      billing_address JSONB,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      paid_at TIMESTAMP,
      shipped_at TIMESTAMP,
      delivered_at TIMESTAMP,
      cancelled_at TIMESTAMP
    )
  `;
  await sql`CREATE INDEX orders_tenant_idx ON orders(tenant_id)`;
  await sql`CREATE INDEX orders_customer_idx ON orders(customer_id)`;
  await sql`CREATE UNIQUE INDEX orders_tenant_number_idx ON orders(tenant_id, order_number)`;
  await sql`CREATE INDEX orders_status_idx ON orders(status)`;
  await sql`CREATE INDEX orders_created_at_idx ON orders(created_at)`;

  await sql`
    CREATE TABLE order_items (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id UUID REFERENCES products(id),
      variation_id UUID REFERENCES product_variations(id),
      name VARCHAR(255) NOT NULL,
      sku VARCHAR(100),
      quantity INTEGER NOT NULL,
      price DECIMAL(10, 2) NOT NULL,
      total DECIMAL(10, 2) NOT NULL,
      attributes JSONB DEFAULT '{}',
      image_url VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX order_items_tenant_idx ON order_items(tenant_id)`;
  await sql`CREATE INDEX order_items_order_idx ON order_items(order_id)`;

  await sql`
    CREATE TABLE order_status_history (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      status order_status NOT NULL,
      notes TEXT,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX status_history_tenant_idx ON order_status_history(tenant_id)`;
  await sql`CREATE INDEX status_history_order_idx ON order_status_history(order_id)`;

  await sql`
    CREATE TABLE carts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      customer_id UUID REFERENCES customers(id),
      session_id VARCHAR(255),
      items JSONB DEFAULT '[]',
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX carts_tenant_idx ON carts(tenant_id)`;
  await sql`CREATE INDEX carts_customer_idx ON carts(customer_id)`;
  await sql`CREATE INDEX carts_session_idx ON carts(session_id)`;
}
