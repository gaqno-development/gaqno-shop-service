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
  },
];

async function seedSingleTenant(
  sql: SqlClient,
  tenant: TenantSeed,
): Promise<void> {
  const inserted = await sql`
    INSERT INTO tenants (slug, name, domain, order_prefix, primary_color, bg_color, secondary_color, is_active, settings)
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
    RETURNING id
  `;
  const tenantId = inserted[0]?.id as string;
  await sql`
    INSERT INTO tenant_feature_flags (tenant_id, feature_shipping, feature_decorations, feature_coupons, feature_recipes, feature_inventory, feature_checkout_pro, feature_pix, feature_dropshipping)
    VALUES (${tenantId}, true, true, true, ${tenant.featureRecipes}, true, true, true, false)
  `;
}

export async function seedDefaultTenants(sql: SqlClient): Promise<void> {
  for (const tenant of TENANT_SEEDS) {
    await seedSingleTenant(sql, tenant);
  }
}
