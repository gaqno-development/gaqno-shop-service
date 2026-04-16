-- Wishlist Tables

-- Wishlists
CREATE TABLE wishlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name VARCHAR(100) DEFAULT 'Favoritos',
    is_public BOOLEAN DEFAULT false,
    share_token VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX wishlists_tenant_idx ON wishlists(tenant_id);
CREATE INDEX wishlists_customer_idx ON wishlists(customer_id);
CREATE UNIQUE INDEX wishlists_share_token_idx ON wishlists(share_token) WHERE share_token IS NOT NULL;

-- Wishlist Items
CREATE TABLE wishlist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wishlist_id UUID NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    note TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX wishlist_items_wishlist_idx ON wishlist_items(wishlist_id);
CREATE INDEX wishlist_items_product_idx ON wishlist_items(product_id);
CREATE UNIQUE INDEX wishlist_items_unique_idx ON wishlist_items(wishlist_id, product_id);