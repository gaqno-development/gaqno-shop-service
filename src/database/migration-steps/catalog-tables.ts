import type { SqlClient } from "./enums";

export async function createCatalogTables(sql: SqlClient): Promise<void> {
  await sql`
    CREATE TABLE categories (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      parent_id UUID REFERENCES categories(id),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL,
      description TEXT,
      image_url VARCHAR(500),
      sort_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX categories_tenant_idx ON categories(tenant_id)`;
  await sql`CREATE UNIQUE INDEX categories_tenant_slug_idx ON categories(tenant_id, slug)`;

  await sql`
    CREATE TABLE products (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      category_id UUID REFERENCES categories(id),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL,
      description TEXT,
      short_description VARCHAR(500),
      price DECIMAL(10, 2) NOT NULL,
      compare_at_price DECIMAL(10, 2),
      cost_price DECIMAL(10, 2),
      sku VARCHAR(100),
      barcode VARCHAR(100),
      weight DECIMAL(8, 2),
      inventory_quantity INTEGER DEFAULT 0,
      inventory_tracked BOOLEAN DEFAULT false,
      allow_backorders BOOLEAN DEFAULT false,
      images JSONB DEFAULT '[]',
      tags JSONB DEFAULT '[]',
      attributes JSONB DEFAULT '{}',
      seo_title VARCHAR(255),
      seo_description VARCHAR(500),
      is_active BOOLEAN DEFAULT true,
      is_featured BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX products_tenant_idx ON products(tenant_id)`;
  await sql`CREATE UNIQUE INDEX products_tenant_slug_idx ON products(tenant_id, slug)`;
  await sql`CREATE INDEX products_category_idx ON products(category_id)`;
  await sql`CREATE INDEX products_active_idx ON products(is_active)`;

  await sql`
    CREATE TABLE product_variations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      sku VARCHAR(100),
      price DECIMAL(10, 2),
      inventory_quantity INTEGER DEFAULT 0,
      options JSONB NOT NULL,
      image_url VARCHAR(500),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX variations_tenant_idx ON product_variations(tenant_id)`;
  await sql`CREATE INDEX variations_product_idx ON product_variations(product_id)`;
}
