import * as dotenv from "dotenv";
import * as path from "path";
import { Pool, PoolClient } from "pg";

dotenv.config({ path: path.join(__dirname, "../.env") });

const PRISMA_DATABASE_URL = process.env.FIFIA_DATABASE_URL;
const TARGET_DATABASE_URL = process.env.DATABASE_URL;
const TENANT_SLUG = process.env.FIFIA_TENANT_SLUG ?? "fifia-doces";

if (!PRISMA_DATABASE_URL || !TARGET_DATABASE_URL) {
  console.error(
    "Missing FIFIA_DATABASE_URL (source) and/or DATABASE_URL (target) env.",
  );
  process.exit(1);
}

const src = new Pool({ connectionString: PRISMA_DATABASE_URL, max: 2 });
const dst = new Pool({ connectionString: TARGET_DATABASE_URL, max: 2 });

const DRY_RUN = process.env.ETL_DRY_RUN === "1";

interface EtlContext {
  readonly tenantId: string;
  readonly idMap: {
    readonly categories: Map<string, string>;
    readonly products: Map<string, string>;
    readonly ingredients: Map<string, string>;
    readonly recipes: Map<string, string>;
    readonly decorations: Map<string, string>;
    readonly users: Map<string, string>;
    readonly orders: Map<string, string>;
    readonly orderItems: Map<string, string>;
  };
}

function emptyIdMap(): EtlContext["idMap"] {
  return {
    categories: new Map(),
    products: new Map(),
    ingredients: new Map(),
    recipes: new Map(),
    decorations: new Map(),
    users: new Map(),
    orders: new Map(),
    orderItems: new Map(),
  };
}

async function resolveTenantId(client: PoolClient): Promise<string> {
  const result = await client.query(
    `SELECT id FROM tenants WHERE slug = $1 LIMIT 1`,
    [TENANT_SLUG],
  );
  if (!result.rows[0]) {
    throw new Error(
      `Tenant '${TENANT_SLUG}' not found. Run provision-fifia-tenant.ts first.`,
    );
  }
  return result.rows[0].id;
}

async function insert(
  client: PoolClient,
  table: string,
  row: Record<string, unknown>,
  returning = "id",
): Promise<Record<string, unknown> | null> {
  const keys = Object.keys(row);
  if (keys.length === 0) return null;
  const cols = keys.map((k) => `"${k}"`).join(", ");
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const values = keys.map((k) => row[k]);
  const sql = `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) RETURNING ${returning}`;
  if (DRY_RUN) {
    console.log(`[DRY] ${table}:`, row);
    return { id: "dry-run" };
  }
  const res = await client.query(sql, values);
  return res.rows[0];
}

async function migrateCategories(
  srcClient: PoolClient,
  dstClient: PoolClient,
  ctx: EtlContext,
) {
  const { rows } = await srcClient.query(
    `SELECT id, name, slug, description, "createdAt", "updatedAt" FROM "Category" ORDER BY "createdAt"`,
  );
  console.log(`[categories] ${rows.length}`);
  for (const c of rows) {
    const inserted = await insert(dstClient, "categories", {
      tenant_id: ctx.tenantId,
      name: c.name,
      slug: c.slug,
      description: c.description ?? null,
      is_active: true,
      created_at: c.createdAt,
      updated_at: c.updatedAt,
    });
    if (inserted?.id) ctx.idMap.categories.set(c.id, String(inserted.id));
  }
}

async function migrateIngredients(
  srcClient: PoolClient,
  dstClient: PoolClient,
  ctx: EtlContext,
) {
  const { rows } = await srcClient.query(
    `SELECT id, name, unit, "gramsPerUnit", stock, "minStock", "costPerUnit", "createdAt", "updatedAt" FROM "Ingredient"`,
  );
  console.log(`[ingredients] ${rows.length}`);
  for (const i of rows) {
    const inserted = await insert(dstClient, "bakery_ingredients", {
      tenant_id: ctx.tenantId,
      name: i.name,
      unit: i.unit,
      grams_per_unit: i.gramsPerUnit,
      stock: i.stock,
      min_stock: i.minStock,
      cost_per_unit: i.costPerUnit,
      created_at: i.createdAt,
      updated_at: i.updatedAt,
    });
    if (inserted?.id) ctx.idMap.ingredients.set(i.id, String(inserted.id));
  }
}

async function migrateRecipes(
  srcClient: PoolClient,
  dstClient: PoolClient,
  ctx: EtlContext,
) {
  const { rows } = await srcClient.query(
    `SELECT id, name, description, "yieldQuantity", "yieldUnit", "laborCost", "overheadCost", "profitMarginPercent", "createdAt", "updatedAt" FROM "Recipe"`,
  );
  console.log(`[recipes] ${rows.length}`);
  for (const r of rows) {
    const inserted = await insert(dstClient, "bakery_recipes", {
      tenant_id: ctx.tenantId,
      name: r.name,
      description: r.description,
      yield_quantity: r.yieldQuantity,
      yield_unit: r.yieldUnit,
      labor_cost: r.laborCost,
      overhead_cost: r.overheadCost,
      profit_margin_percent: r.profitMarginPercent,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    });
    if (inserted?.id) ctx.idMap.recipes.set(r.id, String(inserted.id));
  }

  const { rows: riRows } = await srcClient.query(
    `SELECT "recipeId", "ingredientId", quantity FROM "RecipeIngredient"`,
  );
  for (const ri of riRows) {
    const recipeId = ctx.idMap.recipes.get(ri.recipeId);
    const ingredientId = ctx.idMap.ingredients.get(ri.ingredientId);
    if (!recipeId || !ingredientId) continue;
    await insert(dstClient, "bakery_recipe_ingredients", {
      tenant_id: ctx.tenantId,
      recipe_id: recipeId,
      ingredient_id: ingredientId,
      quantity: ri.quantity,
    });
  }
}

async function migrateDecorations(
  srcClient: PoolClient,
  dstClient: PoolClient,
  ctx: EtlContext,
) {
  const { rows } = await srcClient.query(
    `SELECT d.id, d.name, d.description, d.price, d.type, d."isActive", a.url as image_url,
            d."createdAt", d."updatedAt"
     FROM "Decoration" d
     LEFT JOIN "Asset" a ON a.id = d."imageAssetId"`,
  );
  console.log(`[decorations] ${rows.length}`);
  const typeMap: Record<string, string> = {
    TOPPER: "topper",
    FLOWER: "flower",
    CUSTOM: "custom",
  };
  for (const d of rows) {
    const inserted = await insert(dstClient, "bakery_decorations", {
      tenant_id: ctx.tenantId,
      name: d.name,
      description: d.description,
      price_adjustment: d.price,
      image_url: d.image_url,
      type: typeMap[String(d.type)] ?? "custom",
      is_active: d.isActive,
      created_at: d.createdAt,
      updated_at: d.updatedAt,
    });
    if (inserted?.id) ctx.idMap.decorations.set(d.id, String(inserted.id));
  }
}

async function migrateProducts(
  srcClient: PoolClient,
  dstClient: PoolClient,
  ctx: EtlContext,
) {
  const { rows } = await srcClient.query(
    `SELECT id, name, slug, description, "basePrice", "categoryId", "recipeId",
            "isActive", "allowsReferenceImage", "createdAt", "updatedAt"
     FROM "Product"`,
  );
  console.log(`[products] ${rows.length}`);
  for (const p of rows) {
    const categoryId = ctx.idMap.categories.get(p.categoryId) ?? null;
    const recipeId = p.recipeId ? ctx.idMap.recipes.get(p.recipeId) : null;
    const inserted = await insert(dstClient, "products", {
      tenant_id: ctx.tenantId,
      category_id: categoryId,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price: p.basePrice,
      is_active: p.isActive,
      allows_reference_image: p.allowsReferenceImage,
      recipe_id: recipeId,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    });
    if (inserted?.id) ctx.idMap.products.set(p.id, String(inserted.id));
  }

  const { rows: images } = await srcClient.query(
    `SELECT pi."productId", a.url, pi."order"
     FROM "ProductImage" pi
     JOIN "Asset" a ON a.id = pi."assetId"
     ORDER BY pi."productId", pi."order"`,
  );
  const imagesByProduct = new Map<string, string[]>();
  for (const img of images) {
    const arr = imagesByProduct.get(img.productId) ?? [];
    arr.push(img.url);
    imagesByProduct.set(img.productId, arr);
  }
  for (const [prismaProductId, urls] of imagesByProduct) {
    const productId = ctx.idMap.products.get(prismaProductId);
    if (!productId) continue;
    if (DRY_RUN) {
      console.log(`[DRY] update product ${productId} images`, urls);
      continue;
    }
    await dstClient.query(
      `UPDATE products SET images = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(urls), productId],
    );
  }

  const { rows: sizes } = await srcClient.query(
    `SELECT "productId", name, "priceModifier", servings FROM "ProductSize"`,
  );
  for (const s of sizes) {
    const productId = ctx.idMap.products.get(s.productId);
    if (!productId) continue;
    await insert(dstClient, "bakery_product_sizes", {
      tenant_id: ctx.tenantId,
      product_id: productId,
      name: s.name,
      price_modifier: s.priceModifier,
      servings: s.servings,
    });
  }

  const { rows: pIng } = await srcClient.query(
    `SELECT "productId", "ingredientId", quantity FROM "ProductIngredient"`,
  );
  for (const pi of pIng) {
    const productId = ctx.idMap.products.get(pi.productId);
    const ingredientId = ctx.idMap.ingredients.get(pi.ingredientId);
    if (!productId || !ingredientId) continue;
    await insert(dstClient, "bakery_product_ingredients", {
      tenant_id: ctx.tenantId,
      product_id: productId,
      ingredient_id: ingredientId,
      quantity: pi.quantity,
    });
  }

  const { rows: pDec } = await srcClient.query(
    `SELECT "productId", "decorationId" FROM "ProductDecoration"`,
  );
  for (const pd of pDec) {
    const productId = ctx.idMap.products.get(pd.productId);
    const decorationId = ctx.idMap.decorations.get(pd.decorationId);
    if (!productId || !decorationId) continue;
    await insert(dstClient, "bakery_product_decorations", {
      tenant_id: ctx.tenantId,
      product_id: productId,
      decoration_id: decorationId,
    });
  }
}

function splitName(full: string | null): {
  readonly firstName: string | null;
  readonly lastName: string | null;
} {
  if (!full) return { firstName: null, lastName: null };
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

async function migrateUsers(
  srcClient: PoolClient,
  dstClient: PoolClient,
  ctx: EtlContext,
) {
  const { rows } = await srcClient.query(
    `SELECT id, email, name, phone, "createdAt", "updatedAt"
     FROM "User"
     WHERE role = 'CUSTOMER'`,
  );
  console.log(`[customers] ${rows.length}`);
  for (const u of rows) {
    const { firstName, lastName } = splitName(u.name);
    const inserted = await insert(dstClient, "customers", {
      tenant_id: ctx.tenantId,
      email: u.email,
      first_name: firstName,
      last_name: lastName,
      phone: u.phone,
      metadata: JSON.stringify({ source: "fifia_doces", source_id: u.id }),
      is_active: true,
      created_at: u.createdAt,
      updated_at: u.updatedAt,
    });
    if (inserted?.id) ctx.idMap.users.set(u.id, String(inserted.id));
  }
}

async function migrateOrders(
  srcClient: PoolClient,
  dstClient: PoolClient,
  ctx: EtlContext,
) {
  const statusMap: Record<string, string> = {
    AWAITING_PAYMENT: "pending",
    PAYMENT_CONFIRMED: "confirmed",
    IN_PRODUCTION: "preparing",
    READY_FOR_DELIVERY: "ready",
    OUT_FOR_DELIVERY: "shipped",
    DELIVERED: "delivered",
    CANCELLED: "cancelled",
  };
  const { rows } = await srcClient.query(
    `SELECT id, "userId", status, "paymentStatus", "paymentMethod",
            subtotal, "shippingCost", discount, total,
            "deliveryType", "deliveryDate", "deliveryTime",
            notes, "createdAt", "updatedAt"
     FROM "Order"`,
  );
  console.log(`[orders] ${rows.length}`);
  for (const o of rows) {
    const customerId = ctx.idMap.users.get(o.userId) ?? null;
    const inserted = await insert(dstClient, "orders", {
      tenant_id: ctx.tenantId,
      customer_id: customerId,
      order_number: `FIF-${o.id.slice(-8).toUpperCase()}`,
      status: statusMap[String(o.status)] ?? "pending",
      payment_status: String(o.paymentStatus).toLowerCase(),
      subtotal: o.subtotal,
      shipping_cost: o.shippingCost,
      discount: o.discount,
      total: o.total,
      notes: o.notes,
      metadata: JSON.stringify({
        source: "fifia_doces",
        source_id: o.id,
        deliveryType: o.deliveryType,
        deliveryDate: o.deliveryDate,
        deliveryTime: o.deliveryTime,
      }),
      created_at: o.createdAt,
      updated_at: o.updatedAt,
    });
    if (inserted?.id) ctx.idMap.orders.set(o.id, String(inserted.id));
  }

  const { rows: items } = await srcClient.query(
    `SELECT id, "orderId", "productId", quantity, size, "unitPrice", "totalPrice",
            notes, "referenceImageUrl"
     FROM "OrderItem"`,
  );
  for (const it of items) {
    const orderId = ctx.idMap.orders.get(it.orderId);
    const productId = it.productId ? ctx.idMap.products.get(it.productId) : null;
    if (!orderId) continue;
    const inserted = await insert(dstClient, "order_items", {
      tenant_id: ctx.tenantId,
      order_id: orderId,
      product_id: productId,
      quantity: it.quantity,
      unit_price: it.unitPrice,
      total_price: it.totalPrice,
      size: it.size,
      notes: it.notes,
      reference_image_url: it.referenceImageUrl,
    });
    if (inserted?.id) ctx.idMap.orderItems.set(it.id, String(inserted.id));
  }

  const { rows: itemDecs } = await srcClient.query(
    `SELECT "orderItemId", "decorationId", "customText", price FROM "OrderItemDecoration"`,
  );
  for (const d of itemDecs) {
    const orderItemId = ctx.idMap.orderItems.get(d.orderItemId);
    const decorationId = ctx.idMap.decorations.get(d.decorationId);
    if (!orderItemId || !decorationId) continue;
    await insert(dstClient, "bakery_order_item_decorations", {
      tenant_id: ctx.tenantId,
      order_item_id: orderItemId,
      decoration_id: decorationId,
      custom_text: d.customText,
      price_adjustment: d.price,
      quantity: 1,
    });
  }
}

async function migrateAdminEvents(
  srcClient: PoolClient,
  dstClient: PoolClient,
  ctx: EtlContext,
) {
  const typeMap: Record<string, string> = {
    DELIVERY: "delivery",
    PRODUCTION: "production",
    PICKUP: "pickup",
    REMINDER: "reminder",
  };
  const { rows } = await srcClient.query(
    `SELECT id, title, description, type, date, "endDate", "allDay", color, completed,
            "orderId", "createdAt", "updatedAt"
     FROM "AdminEvent"`,
  );
  console.log(`[admin_events] ${rows.length}`);
  for (const e of rows) {
    const orderId = e.orderId ? ctx.idMap.orders.get(e.orderId) : null;
    await insert(dstClient, "bakery_admin_events", {
      tenant_id: ctx.tenantId,
      title: e.title,
      description: e.description,
      type: typeMap[String(e.type)] ?? "reminder",
      start_at: e.date,
      end_at: e.endDate,
      all_day: e.allDay,
      color: e.color,
      completed: e.completed,
      order_id: orderId,
      created_at: e.createdAt,
      updated_at: e.updatedAt,
    });
  }
}

async function migrateSiteSettings(
  srcClient: PoolClient,
  dstClient: PoolClient,
  ctx: EtlContext,
) {
  const { rows } = await srcClient.query(
    `SELECT s."storeName", s."heroTitle", s."heroSubtitle",
            s."introTitle", s."introText", s."whatsappNumber", s."instagramUrl",
            a.url as hero_image_url
     FROM "SiteSettings" s
     LEFT JOIN "Asset" a ON a.id = s."heroImageId"
     LIMIT 1`,
  );
  const s = rows[0];
  if (!s) return;
  console.log(`[site_settings] 1`);
  if (DRY_RUN) {
    console.log("[DRY] site_settings", s);
    return;
  }
  await dstClient.query(
    `INSERT INTO bakery_site_settings
       (tenant_id, site_name, hero_title, hero_subtitle, hero_image_url,
        intro_text, whatsapp_number, instagram_handle)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (tenant_id) DO UPDATE SET
       site_name = EXCLUDED.site_name,
       hero_title = EXCLUDED.hero_title,
       hero_subtitle = EXCLUDED.hero_subtitle,
       hero_image_url = EXCLUDED.hero_image_url,
       intro_text = EXCLUDED.intro_text,
       whatsapp_number = EXCLUDED.whatsapp_number,
       instagram_handle = EXCLUDED.instagram_handle,
       updated_at = NOW()`,
    [
      ctx.tenantId,
      s.storeName,
      s.heroTitle,
      s.heroSubtitle,
      s.hero_image_url,
      [s.introTitle, s.introText].filter(Boolean).join("\n\n"),
      s.whatsappNumber,
      s.instagramUrl,
    ],
  );
}

async function run() {
  console.log(`ETL Fifia Doces → gaqno-shop-service (dry=${DRY_RUN})`);
  const srcClient = await src.connect();
  const dstClient = await dst.connect();
  try {
    const tenantId = await resolveTenantId(dstClient);
    const ctx: EtlContext = { tenantId, idMap: emptyIdMap() };

    await migrateCategories(srcClient, dstClient, ctx);
    await migrateIngredients(srcClient, dstClient, ctx);
    await migrateRecipes(srcClient, dstClient, ctx);
    await migrateDecorations(srcClient, dstClient, ctx);
    await migrateProducts(srcClient, dstClient, ctx);
    await migrateUsers(srcClient, dstClient, ctx);
    await migrateOrders(srcClient, dstClient, ctx);
    await migrateAdminEvents(srcClient, dstClient, ctx);
    await migrateSiteSettings(srcClient, dstClient, ctx);

    console.log("\n=== ETL summary ===");
    for (const [k, m] of Object.entries(ctx.idMap)) {
      console.log(`${k}: ${m.size}`);
    }
  } finally {
    srcClient.release();
    dstClient.release();
    await src.end();
    await dst.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
