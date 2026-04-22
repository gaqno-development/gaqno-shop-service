import type { SqlClient } from "./enums";

interface TenantSeed {
  slug: string;
  name: string;
  domain: string;
  orderPrefix: string;
  primaryColor: string;
  bgColor: string;
  secondaryColor: string;
  featureRecipes: boolean;
  featureBakery: boolean;
}

const TENANT_SEEDS: readonly TenantSeed[] = [
  {
    slug: "gaqno-shop",
    name: "Gaqno Shop",
    domain: "shop.gaqno.com.br",
    orderPrefix: "GS",
    primaryColor: "#e11d48",
    bgColor: "#ffffff",
    secondaryColor: "#f9a8d4",
    featureRecipes: false,
    featureBakery: false,
  },
  {
    slug: "fifia-doces",
    name: "Fifia Doces",
    domain: "fifiadoces.com.br",
    orderPrefix: "FIFIA",
    primaryColor: "#e11d48",
    bgColor: "#fffbf7",
    secondaryColor: "#f9a8d4",
    featureRecipes: true,
    featureBakery: true,
  },
];

async function ensureTenant(
  sql: SqlClient,
  tenant: TenantSeed,
): Promise<void> {
  await sql`
    INSERT INTO tenants (
      slug, name, domain, order_prefix, primary_color, bg_color, secondary_color, is_active, settings
    )
    VALUES (
      ${tenant.slug},
      ${tenant.name},
      ${tenant.domain},
      ${tenant.orderPrefix},
      ${tenant.primaryColor},
      ${tenant.bgColor},
      ${tenant.secondaryColor},
      true,
      ${'{"defaultCurrency": "BRL"}'}
    )
    ON CONFLICT (slug) DO NOTHING
  `;

  const row = await sql`SELECT id FROM tenants WHERE slug = ${tenant.slug} LIMIT 1`;
  const tenantId = row[0]?.id;
  if (!tenantId) return;

  await sql`
    INSERT INTO tenant_feature_flags (
      tenant_id,
      feature_shipping,
      feature_decorations,
      feature_coupons,
      feature_recipes,
      feature_inventory,
      feature_checkout_pro,
      feature_pix,
      feature_dropshipping,
      feature_bakery
    )
    VALUES (
      ${tenantId},
      true,
      true,
      true,
      ${tenant.featureRecipes},
      true,
      true,
      true,
      false,
      ${tenant.featureBakery}
    )
    ON CONFLICT (tenant_id) DO NOTHING
  `;
}

export async function seedDefaultTenants(sql: SqlClient): Promise<void> {
  for (const tenant of TENANT_SEEDS) {
    await ensureTenant(sql, tenant);
  }
}
