import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { products } from "../database/schema";
import type { ShopDatabase } from "../database/shop-database.type";
import type {
  ImportedProductInsertInput,
  ImportedProductRecord,
  ImportedProductRepositoryPort,
} from "./dropshipping-import.types";

@Injectable()
export class ImportedProductRepository
  implements ImportedProductRepositoryPort
{
  constructor(@Inject("DATABASE") private readonly db: ShopDatabase) {}

  async findBySource(
    tenantId: string,
    providerCode: string,
    externalId: string,
  ): Promise<ImportedProductRecord | undefined> {
    const rows = await this.db
      .select()
      .from(products)
      .where(
        and(
          eq(products.tenantId, tenantId),
          eq(products.sourceProvider, providerCode),
          eq(products.sourceProductId, externalId),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) return undefined;
    return {
      id: row.id,
      tenantId: row.tenantId,
      slug: row.slug,
      name: row.name,
      priceBrl: parseFloat(row.price),
      costBrl: row.costPrice ? parseFloat(row.costPrice) : 0,
      sourceProvider: row.sourceProvider ?? providerCode,
      sourceProductId: row.sourceProductId ?? externalId,
    };
  }

  async insert(
    input: ImportedProductInsertInput,
  ): Promise<ImportedProductRecord> {
    const [row] = await this.db
      .insert(products)
      .values({
        tenantId: input.tenantId,
        categoryId: input.categoryId ?? null,
        name: input.name,
        slug: input.slug,
        description: input.description,
        shortDescription: input.description.slice(0, 200),
        price: input.priceBrl.toFixed(2),
        costPrice: input.costBrl.toFixed(2),
        images: input.images,
        attributes: input.attributes,
        sourceProvider: input.sourceProvider,
        sourceProductId: input.sourceProductId,
        sourceCostAmount: input.sourceCostAmount.toFixed(2),
        sourceCostCurrency: input.sourceCostCurrency,
        marginOverridePercent: input.marginOverridePercent
          ? input.marginOverridePercent.toFixed(2)
          : null,
        lastSyncedAt: new Date(),
        syncStatus: "synced",
        isActive: input.isActive,
      })
      .returning();
    return {
      id: row.id,
      tenantId: row.tenantId,
      slug: row.slug,
      name: row.name,
      priceBrl: parseFloat(row.price),
      costBrl: row.costPrice ? parseFloat(row.costPrice) : input.costBrl,
      sourceProvider: input.sourceProvider,
      sourceProductId: input.sourceProductId,
    };
  }
}
