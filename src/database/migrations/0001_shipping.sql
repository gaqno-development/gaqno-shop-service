-- Shipping Methods
CREATE TABLE shipping_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    carrier VARCHAR(50) NOT NULL,
    service_code VARCHAR(50),
    flat_rate DECIMAL(10, 2),
    sort_order INTEGER DEFAULT 0,
    estimated_delivery_days_min INTEGER DEFAULT 1,
    estimated_delivery_days_max INTEGER DEFAULT 7,
    free_shipping_threshold DECIMAL(10, 2),
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX shipping_methods_tenant_idx ON shipping_methods(tenant_id);
CREATE INDEX shipping_methods_carrier_idx ON shipping_methods(carrier);

-- Shipping Rates Cache
CREATE TABLE shipping_rates_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cache_key VARCHAR(255) NOT NULL,
    cep VARCHAR(10) NOT NULL,
    product_ids TEXT[] DEFAULT '{}',
    rates JSONB DEFAULT '[]',
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX shipping_rates_cache_tenant_idx ON shipping_rates_cache(tenant_id);
CREATE INDEX shipping_rates_cache_cep_idx ON shipping_rates_cache(cep);
CREATE INDEX shipping_rates_cache_expires_idx ON shipping_rates_cache(expires_at);