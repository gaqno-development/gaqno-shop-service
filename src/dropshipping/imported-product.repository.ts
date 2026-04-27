import { Inject, Injectable } from "@nestjs/common";
import { and, eq, desc, sql, inArray } from "drizzle-orm";
import { products } from "../database/schema";
import type { ShopDatabase } from "../database/shop-database.type";
import type {
  ImportedProductInsertInput,
  ImportedProductRecord,
  ImportedProductRepositoryPort,
} from "./dropshipping-import.types";

interface ImportedProductsQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly status?: "active" | "inactive";
}

interface ImportedProductsResult {
  readonly items: readonly ImportedProductRecord[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

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
      isActive: row.isActive,
      marginPercent: row.marginOverridePercent ? parseFloat(row.marginOverridePercent) : 0,
      categoryId: row.categoryId ?? undefined,
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
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
      isActive: row.isActive,
      marginPercent: row.marginOverridePercent ? parseFloat(row.marginOverridePercent) : 0,
      categoryId: row.categoryId ?? undefined,
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  async findAll(
    tenantId: string,
    query: ImportedProductsQuery,
  ): Promise<ImportedProductsResult> {
    const offset = (query.page - 1) * query.pageSize;

    const whereConditions = [eq(products.tenantId, tenantId)];
    if (query.status === "active") {
      whereConditions.push(eq(products.isActive, true));
    } else if (query.status === "inactive") {
      whereConditions.push(eq(products.isActive, false));
    }

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(and(...whereConditions));

    const rows = await this.db
      .select()
      .from(products)
      .where(and(...whereConditions))
      .orderBy(desc(products.createdAt))
      .limit(query.pageSize)
      .offset(offset);

    return {
      items: rows.map((row) => ({
        id: row.id,
        tenantId: row.tenantId,
        slug: row.slug,
        name: row.name,
        priceBrl: parseFloat(row.price),
        costBrl: row.costPrice ? parseFloat(row.costPrice) : 0,
        sourceProvider: row.sourceProvider ?? "",
        sourceProductId: row.sourceProductId ?? "",
        isActive: row.isActive,
        marginPercent: row.marginOverridePercent ? parseFloat(row.marginOverridePercent) : 0,
        categoryId: row.categoryId ?? undefined,
        createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
        updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
      })),
      total: countResult?.count ?? 0,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findById(tenantId: string, productId: string): Promise<ImportedProductRecord | undefined> {
    const rows = await this.db
      .select()
      .from(products)
      .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)))
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
      sourceProvider: row.sourceProvider ?? "",
      sourceProductId: row.sourceProductId ?? "",
      isActive: row.isActive,
      marginPercent: row.marginOverridePercent ? parseFloat(row.marginOverridePercent) : 0,
      categoryId: row.categoryId ?? undefined,
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  async update(
    tenantId: string,
    productId: string,
    data: { isActive?: boolean; marginPercent?: number; categoryId?: string },
  ): Promise<void> {
    const updates: Record<string, unknown> = {};
    if (data.isActive !== undefined) updates.isActive = data.isActive;
    if (data.marginPercent !== undefined) updates.marginOverridePercent = data.marginPercent.toFixed(2);
    if (data.categoryId !== undefined) updates.categoryId = data.categoryId;

    await this.db
      .update(products)
      .set(updates)
      .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)));
  }

  async delete(tenantId: string, productId: string): Promise<void> {
    await this.db
      .delete(products)
      .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)));
  }

  async bulkAction(
    tenantId: string,
    productIds: readonly string[],
    action: "activate" | "deactivate" | "delete",
  ): Promise<void> {
    if (action === "delete") {
      await this.db
        .delete(products)
        .where(
          and(eq(products.tenantId, tenantId), inArray(products.id, [...productIds])),
        );
    } else {
      const isActive = action === "activate";
      await this.db
        .update(products)
        .set({ isActive })
        .where(
          and(eq(products.tenantId, tenantId), inArray(products.id, [...productIds])),
        );
    }
  }
}
