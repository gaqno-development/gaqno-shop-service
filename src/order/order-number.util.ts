import { eq, sql } from "drizzle-orm";
import { orders, tenants } from "../database/schema";
import { ShopDatabase } from "../database/shop-database.type";

const ORDER_NUMBER_PAD_LENGTH = 4;
const PREFIX_FALLBACK_LENGTH = 3;

export async function generateOrderNumber(
  db: ShopDatabase,
  tenantId: string,
  tenantSlug: string,
): Promise<string> {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });
  const prefix =
    tenant?.orderPrefix ??
    tenantSlug.toUpperCase().slice(0, PREFIX_FALLBACK_LENGTH);

  const countRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(eq(orders.tenantId, tenantId));

  const nextNumber = (countRow[0]?.count ?? 0) + 1;
  const padded = nextNumber.toString().padStart(ORDER_NUMBER_PAD_LENGTH, "0");
  return `${prefix}-${padded}`;
}
