-- Loyalty Program Tables

-- Customer Points
CREATE TABLE customer_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 0,
    lifetime_earned INTEGER NOT NULL DEFAULT 0,
    lifetime_redeemed INTEGER NOT NULL DEFAULT 0,
    tier VARCHAR(20) DEFAULT 'bronze',
    tier_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX customer_points_tenant_idx ON customer_points(tenant_id);
CREATE UNIQUE INDEX customer_points_customer_idx ON customer_points(tenant_id, customer_id);

-- Points Transactions
CREATE TABLE points_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL,
    amount INTEGER NOT NULL,
    description VARCHAR(255),
    reference_id VARCHAR(100),
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX points_transactions_tenant_idx ON points_transactions(tenant_id);
CREATE INDEX points_transactions_customer_idx ON points_transactions(customer_id);
CREATE INDEX points_transactions_order_idx ON points_transactions(order_id);
CREATE INDEX points_transactions_created_idx ON points_transactions(created_at);

-- Points Redemption History
CREATE TABLE points_redemption_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    points_redeemed INTEGER NOT NULL,
    discount_received DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX points_redemption_tenant_idx ON points_redemption_history(tenant_id);
CREATE INDEX points_redemption_customer_idx ON points_redemption_history(customer_id);

-- Customer Tier Rules
CREATE TABLE customer_tier_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tier VARCHAR(20) NOT NULL,
    min_points INTEGER NOT NULL,
    points_multiplier DECIMAL(3, 2) DEFAULT 1.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX tier_rules_tenant_idx ON customer_tier_rules(tenant_id);
CREATE UNIQUE INDEX tier_rules_tier_idx ON customer_tier_rules(tenant_id, tier);

-- Insert default tier rules
INSERT INTO customer_tier_rules (tenant_id, tier, min_points, points_multiplier) VALUES
-- These will be duplicated per tenant - placeholder values
;