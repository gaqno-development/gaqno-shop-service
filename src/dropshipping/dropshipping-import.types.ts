import type { PsychologicalRounding } from "./pricing/margin-calculator";

export interface DropshippingTenantConfig {
  readonly tenantId: string;
  readonly providerCode: string;
  readonly defaultMarginPercent: number;
  readonly rounding: PsychologicalRounding;
}

export interface DropshippingTenantConfigPort {
  getConfig(tenantId: string): Promise<DropshippingTenantConfig>;
}

export const DROPSHIPPING_TENANT_CONFIG = Symbol(
  "DROPSHIPPING_TENANT_CONFIG",
);

export interface ImportedProductRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly slug: string;
  readonly name: string;
  readonly priceBrl: number;
  readonly costBrl: number;
  readonly sourceProvider: string;
  readonly sourceProductId: string;
  readonly isActive: boolean;
  readonly marginPercent: number;
  readonly categoryId?: string;
  readonly categoryName?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ImportProductInput {
  readonly tenantId: string;
  readonly providerCode: string;
  readonly externalId: string;
  readonly overrideMarginPercent?: number;
  readonly categoryId?: string;
  readonly makeActive: boolean;
}

export interface ImportedProductRepositoryPort {
  findBySource(
    tenantId: string,
    providerCode: string,
    externalId: string,
  ): Promise<ImportedProductRecord | undefined>;
  findAll(
    tenantId: string,
    query: ImportedProductsQuery,
  ): Promise<ImportedProductsResult>;
  findById(tenantId: string, productId: string): Promise<ImportedProductRecord | undefined>;
  insert(input: ImportedProductInsertInput): Promise<ImportedProductRecord>;
  update(
    tenantId: string,
    productId: string,
    data: { isActive?: boolean; marginPercent?: number; categoryId?: string },
  ): Promise<void>;
  delete(tenantId: string, productId: string): Promise<void>;
  bulkAction(
    tenantId: string,
    productIds: readonly string[],
    action: "activate" | "deactivate" | "delete",
  ): Promise<void>;
}

export const IMPORTED_PRODUCT_REPOSITORY = Symbol(
  "IMPORTED_PRODUCT_REPOSITORY",
);

export interface ImportedProductInsertInput {
  readonly tenantId: string;
  readonly categoryId?: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  readonly images: readonly string[];
  readonly priceBrl: number;
  readonly costBrl: number;
  readonly sourceProvider: string;
  readonly sourceProductId: string;
  readonly sourceCostCurrency: string;
  readonly sourceCostAmount: number;
  readonly marginOverridePercent?: number;
  readonly attributes: Record<string, string>;
  readonly isActive: boolean;
}

export interface ImportedProductsResult {
  readonly items: readonly ImportedProductRecord[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface ImportedProductsQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly status?: "active" | "inactive";
}
