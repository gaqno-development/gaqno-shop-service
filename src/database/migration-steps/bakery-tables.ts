import type { SqlClient } from "./enums";

const SAFE_IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function assertSafeIdentifier(name: string): void {
  if (!SAFE_IDENTIFIER_PATTERN.test(name)) {
    throw new Error(`Unsafe SQL identifier: ${name}`);
  }
}

async function ensureEnumValue(
  sql: SqlClient,
  enumName: string,
  value: string,
): Promise<void> {
  assertSafeIdentifier(enumName);
  assertSafeIdentifier(value);
  await sql.unsafe(
    `ALTER TYPE ${enumName} ADD VALUE IF NOT EXISTS '${value}'`,
  );
}

async function ensureColumn(
  sql: SqlClient,
  table: string,
  column: string,
  typeWithDefault: string,
): Promise<void> {
  await sql.unsafe(
    `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${typeWithDefault}`,
  );
}

export async function applyBakeryTables(sql: SqlClient): Promise<void> {
  await sql`
    DO $$ BEGIN
      CREATE TYPE bakery_decoration_type AS ENUM ('topping', 'filling', 'message', 'theme', 'extra');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `;
  await sql`
    DO $$ BEGIN
      CREATE TYPE bakery_movement_type AS ENUM ('in', 'out', 'adjustment');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `;
  await sql`
    DO $$ BEGIN
      CREATE TYPE bakery_event_type AS ENUM ('stock_purchase', 'production', 'delivery', 'custom');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `;

  await ensureEnumValue(sql, "order_status", "awaiting_decoration_review");
  await ensureEnumValue(sql, "order_status", "decoration_approved");

  await ensureColumn(
    sql,
    "tenant_feature_flags",
    "feature_bakery",
    "BOOLEAN DEFAULT false",
  );
  await ensureColumn(
    sql,
    "products",
    "allows_reference_image",
    "BOOLEAN DEFAULT false",
  );
  await ensureColumn(sql, "products", "lead_days", "INTEGER");
  await ensureColumn(sql, "products", "recipe_id", "UUID");
  await ensureColumn(
    sql,
    "order_items",
    "reference_image_url",
    "VARCHAR(500)",
  );
  await ensureColumn(sql, "order_items", "size", "VARCHAR(100)");
  await ensureColumn(sql, "order_items", "notes", "TEXT");

  await sql`
    CREATE TABLE IF NOT EXISTS bakery_ingredients (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      unit VARCHAR(20) NOT NULL,
      grams_per_unit DECIMAL(10, 3),
      stock DECIMAL(10, 3) NOT NULL DEFAULT 0,
      min_stock DECIMAL(10, 3) NOT NULL DEFAULT 0,
      cost_per_unit DECIMAL(10, 2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS bakery_ingredients_tenant_idx ON bakery_ingredients(tenant_id)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS bakery_ingredients_tenant_name_idx ON bakery_ingredients(tenant_id, name)`;

  await sql`
    CREATE TABLE IF NOT EXISTS bakery_recipes (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      yield_quantity DECIMAL(10, 3) NOT NULL DEFAULT 1,
      yield_unit VARCHAR(40) NOT NULL DEFAULT 'unidade',
      labor_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
      overhead_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
      profit_margin_percent DECIMAL(5, 2) NOT NULL DEFAULT 50,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS bakery_recipes_tenant_idx ON bakery_recipes(tenant_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS bakery_recipe_ingredients (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      recipe_id UUID NOT NULL REFERENCES bakery_recipes(id) ON DELETE CASCADE,
      ingredient_id UUID NOT NULL REFERENCES bakery_ingredients(id) ON DELETE RESTRICT,
      quantity DECIMAL(10, 3) NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS bakery_recipe_ingredients_tenant_idx ON bakery_recipe_ingredients(tenant_id)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS bakery_recipe_ingredient_unique_idx ON bakery_recipe_ingredients(recipe_id, ingredient_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS bakery_product_ingredients (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      ingredient_id UUID NOT NULL REFERENCES bakery_ingredients(id) ON DELETE RESTRICT,
      quantity DECIMAL(10, 3) NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS bakery_product_ingredients_tenant_idx ON bakery_product_ingredients(tenant_id)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS bakery_product_ingredient_unique_idx ON bakery_product_ingredients(product_id, ingredient_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS bakery_inventory_movements (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      ingredient_id UUID NOT NULL REFERENCES bakery_ingredients(id) ON DELETE CASCADE,
      type bakery_movement_type NOT NULL,
      quantity DECIMAL(10, 3) NOT NULL,
      reason VARCHAR(255),
      order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS bakery_movements_tenant_idx ON bakery_inventory_movements(tenant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS bakery_movements_ingredient_idx ON bakery_inventory_movements(ingredient_id)`;
  await sql`CREATE INDEX IF NOT EXISTS bakery_movements_order_idx ON bakery_inventory_movements(order_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS bakery_decorations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price DECIMAL(10, 2) NOT NULL DEFAULT 0,
      type bakery_decoration_type NOT NULL,
      image_url VARCHAR(500),
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS bakery_decorations_tenant_idx ON bakery_decorations(tenant_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS bakery_product_decorations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      decoration_id UUID NOT NULL REFERENCES bakery_decorations(id) ON DELETE CASCADE
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS bakery_product_decorations_tenant_idx ON bakery_product_decorations(tenant_id)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS bakery_product_decoration_unique_idx ON bakery_product_decorations(product_id, decoration_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS bakery_order_item_decorations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
      decoration_id UUID NOT NULL REFERENCES bakery_decorations(id) ON DELETE RESTRICT,
      custom_text VARCHAR(255),
      price DECIMAL(10, 2) NOT NULL DEFAULT 0
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS bakery_order_item_decorations_tenant_idx ON bakery_order_item_decorations(tenant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS bakery_order_item_decorations_item_idx ON bakery_order_item_decorations(order_item_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS bakery_product_sizes (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      price_modifier DECIMAL(10, 2) NOT NULL DEFAULT 0,
      servings INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS bakery_product_sizes_tenant_idx ON bakery_product_sizes(tenant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS bakery_product_sizes_product_idx ON bakery_product_sizes(product_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS bakery_admin_events (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      type bakery_event_type NOT NULL,
      date TIMESTAMP NOT NULL,
      end_date TIMESTAMP,
      all_day BOOLEAN NOT NULL DEFAULT true,
      color VARCHAR(20),
      completed BOOLEAN NOT NULL DEFAULT false,
      order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS bakery_admin_events_tenant_idx ON bakery_admin_events(tenant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS bakery_admin_events_date_idx ON bakery_admin_events(date)`;
  await sql`CREATE INDEX IF NOT EXISTS bakery_admin_events_order_idx ON bakery_admin_events(order_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS bakery_site_settings (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      store_name VARCHAR(255) NOT NULL DEFAULT '',
      payment_descriptor VARCHAR(100) NOT NULL DEFAULT '',
      hero_title VARCHAR(255) NOT NULL DEFAULT '',
      hero_subtitle VARCHAR(500) NOT NULL DEFAULT '',
      hero_image_url VARCHAR(500),
      intro_title VARCHAR(255) NOT NULL DEFAULT '',
      intro_text TEXT NOT NULL DEFAULT '',
      whatsapp_number VARCHAR(30) NOT NULL DEFAULT '',
      instagram_url VARCHAR(255) NOT NULL DEFAULT '',
      metadata JSONB DEFAULT '{}'::jsonb,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS bakery_site_settings_tenant_idx ON bakery_site_settings(tenant_id)`;

  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'products_recipe_id_fkey'
      ) THEN
        ALTER TABLE products ADD CONSTRAINT products_recipe_id_fkey
          FOREIGN KEY (recipe_id) REFERENCES bakery_recipes(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `;
}
