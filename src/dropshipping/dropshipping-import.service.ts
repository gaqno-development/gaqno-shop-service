import { ConflictException, Inject, Injectable } from "@nestjs/common";
import type { SupplierProductDetail } from "@gaqno-development/types";
import { slugifyWithSuffix } from "../common/utils/slugify";
import {
  DROPSHIPPING_TENANT_CONFIG,
  IMPORTED_PRODUCT_REPOSITORY,
  type DropshippingTenantConfigPort,
  type ImportProductInput,
  type ImportedProductRecord,
  type ImportedProductRepositoryPort,
} from "./dropshipping-import.types";
import { calculateFinalPrice } from "./pricing/margin-calculator";
import { FxRateService } from "./pricing/fx-rate.service";
import { SUPPLIER_PROVIDER_REGISTRY } from "./providers/provider-tokens";
import type { ProviderRegistry } from "./providers/provider-registry";

@Injectable()
export class DropshippingImportService {
  constructor(
    @Inject(SUPPLIER_PROVIDER_REGISTRY)
    private readonly registry: ProviderRegistry,
    private readonly fxService: FxRateService,
    @Inject(DROPSHIPPING_TENANT_CONFIG)
    private readonly configPort: DropshippingTenantConfigPort,
    @Inject(IMPORTED_PRODUCT_REPOSITORY)
    private readonly productRepo: ImportedProductRepositoryPort,
  ) {}

  async importProduct(
    input: ImportProductInput,
  ): Promise<ImportedProductRecord> {
    const available = this.registry.availableCodes();
    if (!available.includes(input.providerCode as (typeof available)[number])) {
      throw new Error(`Unknown provider code "${input.providerCode}"`);
    }
    const provider = this.registry.get(
      input.providerCode as (typeof available)[number],
    );
    await this.ensureNotAlreadyImported(input);
    const detail = await provider.getDetails(input.externalId);
    const config = await this.configPort.getConfig(input.tenantId);
    const { costBrl, finalPriceBrl } = await this.computePrice(
      detail,
      config.defaultMarginPercent,
      input.overrideMarginPercent,
      config.rounding,
    );

    return this.productRepo.insert({
      tenantId: input.tenantId,
      categoryId: input.categoryId,
      name: detail.title,
      slug: slugifyWithSuffix(detail.title, detail.externalId),
      description: detail.description,
      images: detail.images,
      priceBrl: finalPriceBrl,
      costBrl,
      sourceProvider: input.providerCode,
      sourceProductId: detail.externalId,
      sourceCostCurrency: "USD",
      sourceCostAmount: detail.priceUsd.min,
      marginOverridePercent: input.overrideMarginPercent,
      attributes: detail.attributes as Record<string, string>,
      isActive: input.makeActive,
    });
  }

  private async ensureNotAlreadyImported(
    input: ImportProductInput,
  ): Promise<void> {
    const existing = await this.productRepo.findBySource(
      input.tenantId,
      input.providerCode,
      input.externalId,
    );
    if (existing) {
      throw new ConflictException(
        `Product already imported: ${input.providerCode}/${input.externalId}`,
      );
    }
  }

  private async computePrice(
    detail: SupplierProductDetail,
    defaultMarginPercent: number,
    overrideMarginPercent: number | undefined,
    rounding: "none" | "ninety" | "ninety_nine",
  ): Promise<{ costBrl: number; finalPriceBrl: number }> {
    const fxRate = await this.fxService.getRate("USD", "BRL");
    const { costBrl, finalPriceBrl } = calculateFinalPrice({
      costUsd: detail.priceUsd.min,
      fxRate,
      marginPercent: defaultMarginPercent,
      overrideMarginPercent,
      rounding,
    });
    return { costBrl, finalPriceBrl };
  }
}
