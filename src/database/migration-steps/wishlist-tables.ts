import type { SqlClient } from "./enums";

export async function applyWishlistTables(sql: SqlClient): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS wishlists (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      name VARCHAR(100) DEFAULT 'Favoritos',
      is_public BOOLEAN DEFAULT false,
      share_token VARCHAR(64),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS wishlists_tenant_idx ON wishlists(tenant_id)`;
  await sql`CREATE INDEX IF NOT EXISTS wishlists_customer_idx ON wishlists(customer_id)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS wishlists_share_token_idx ON wishlists(share_token)`;

  await sql`
    CREATE TABLE IF NOT EXISTS wishlist_items (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      wishlist_id UUID NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      note TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS wishlist_items_wishlist_idx ON wishlist_items(wishlist_id)`;
  await sql`CREATE INDEX IF NOT EXISTS wishlist_items_product_idx ON wishlist_items(product_id)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS wishlist_items_unique_idx ON wishlist_items(wishlist_id, product_id)`;
}
