-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');
CREATE TYPE payment_status AS ENUM ('pending', 'approved', 'authorized', 'in_process', 'in_mediation', 'rejected', 'cancelled', 'refunded', 'charged_back');
CREATE TYPE payment_method AS ENUM ('credit_card', 'debit_card', 'pix', 'boleto', 'wallet');

-- Tenants table
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    description TEXT,
    primary_color VARCHAR(7) DEFAULT '#e11d48',
    bg_color VARCHAR(7) DEFAULT '#ffffff',
    secondary_color VARCHAR(7) DEFAULT '#f9a8d4',
    logo_url VARCHAR(500),
    favicon_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    is_dropshipping BOOLEAN DEFAULT false,
    order_prefix VARCHAR(10) DEFAULT 'ORD',
    mercado_pago_access_token VARCHAR(500),
    mercado_pago_public_key VARCHAR(500),
    mercado_pago_webhook_secret VARCHAR(500),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX tenants_slug_idx ON tenants(slug);
CREATE UNIQUE INDEX tenants_domain_idx ON tenants(domain);

-- Feature flags per tenant
CREATE TABLE tenant_feature_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    feature_shipping BOOLEAN DEFAULT true,
    feature_decorations BOOLEAN DEFAULT true,
    feature_coupons BOOLEAN DEFAULT true,
    feature_recipes BOOLEAN DEFAULT false,
    feature_inventory BOOLEAN DEFAULT true,
    feature_checkout_pro BOOLEAN DEFAULT true,
    feature_pix BOOLEAN DEFAULT true,
    feature_dropshipping BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX feature_flags_tenant_idx ON tenant_feature_flags(tenant_id);

-- Categories
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
);

CREATE INDEX categories_tenant_idx ON categories(tenant_id);
CREATE UNIQUE INDEX categories_tenant_slug_idx ON categories(tenant_id, slug);

-- Products
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
);

CREATE INDEX products_tenant_idx ON products(tenant_id);
CREATE UNIQUE INDEX products_tenant_slug_idx ON products(tenant_id, slug);
CREATE INDEX products_category_idx ON products(category_id);
CREATE INDEX products_active_idx ON products(is_active);

-- Product variations
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
);

CREATE INDEX variations_tenant_idx ON product_variations(tenant_id);
CREATE INDEX variations_product_idx ON product_variations(product_id);

-- Customers
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
);

CREATE INDEX customers_tenant_idx ON customers(tenant_id);
CREATE INDEX customers_email_idx ON customers(email);
CREATE UNIQUE INDEX customers_tenant_email_idx ON customers(tenant_id, email);

-- Customer addresses
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
);

CREATE INDEX addresses_tenant_idx ON customer_addresses(tenant_id);
CREATE INDEX addresses_customer_idx ON customer_addresses(customer_id);

-- Orders
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
);

CREATE INDEX orders_tenant_idx ON orders(tenant_id);
CREATE INDEX orders_customer_idx ON orders(customer_id);
CREATE UNIQUE INDEX orders_tenant_number_idx ON orders(tenant_id, order_number);
CREATE INDEX orders_status_idx ON orders(status);
CREATE INDEX orders_created_at_idx ON orders(created_at);

-- Order items
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
);

CREATE INDEX order_items_tenant_idx ON order_items(tenant_id);
CREATE INDEX order_items_order_idx ON order_items(order_id);

-- Order status history
CREATE TABLE order_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status order_status NOT NULL,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX status_history_tenant_idx ON order_status_history(tenant_id);
CREATE INDEX status_history_order_idx ON order_status_history(order_id);

-- Carts
CREATE TABLE carts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    session_id VARCHAR(255),
    items JSONB DEFAULT '[]',
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX carts_tenant_idx ON carts(tenant_id);
CREATE INDEX carts_customer_idx ON carts(customer_id);
CREATE INDEX carts_session_idx ON carts(session_id);

-- Enable Row Level Security
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tenant isolation
CREATE POLICY tenant_isolation_policy ON tenants
    USING (id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_policy ON tenant_feature_flags
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_policy ON categories
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_policy ON products
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_policy ON product_variations
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_policy ON customers
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_policy ON customer_addresses
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_policy ON orders
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_policy ON order_items
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_policy ON order_status_history
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_policy ON carts
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

-- Insert default tenant (for shop.gaqno.com.br)
INSERT INTO tenants (slug, name, domain, order_prefix, is_active, settings) VALUES
('gaqno-shop', 'Gaqno Shop', 'shop.gaqno.com.br', 'GS', true, '{"defaultCurrency": "BRL"}');

-- Insert feature flags for default tenant
INSERT INTO tenant_feature_flags (tenant_id, feature_shipping, feature_decorations, feature_coupons, feature_recipes, feature_inventory, feature_checkout_pro, feature_pix, feature_dropshipping)
SELECT id, true, true, true, false, true, true, true, false
FROM tenants WHERE slug = 'gaqno-shop';

-- Insert Fifia Doces tenant
INSERT INTO tenants (slug, name, domain, order_prefix, primary_color, bg_color, secondary_color, is_active, settings) VALUES
('fifia-doces', 'Fifia Doces', 'fifiadoces.com.br', 'FIFIA', '#e11d48', '#fffbf7', '#f9a8d4', true, '{"defaultCurrency": "BRL"}');

-- Insert feature flags for Fifia Doces
INSERT INTO tenant_feature_flags (tenant_id, feature_shipping, feature_decorations, feature_coupons, feature_recipes, feature_inventory, feature_checkout_pro, feature_pix, feature_dropshipping)
SELECT id, true, true, true, true, true, true, true, false
FROM tenants WHERE slug = 'fifia-doces';
