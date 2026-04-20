import { Inject, Injectable } from "@nestjs/common";
import type {
  DropshippingSearchRequest,
  DropshippingSearchResponse,
  SupplierProductDetail,
  SupplierSearchQuery,
} from "@gaqno-development/types";
import type { ProviderRegistry } from "./providers/provider-registry";
import { SUPPLIER_PROVIDER_REGISTRY } from "./providers/provider-tokens";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_SHIP_TO = "BR";

export type DropshippingSearchInput = DropshippingSearchRequest;

@Injectable()
export class DropshippingCatalogService {
  constructor(
    @Inject(SUPPLIER_PROVIDER_REGISTRY)
    private readonly registry: ProviderRegistry,
  ) {}

  async search(
    input: DropshippingSearchInput,
  ): Promise<DropshippingSearchResponse> {
    const provider = this.resolveProvider(input.providerCode);
    const query: SupplierSearchQuery = {
      keyword: input.keyword,
      categoryId: input.categoryId,
      minPriceUsd: input.minPriceUsd,
      maxPriceUsd: input.maxPriceUsd,
      minRating: input.minRating,
      minOrders: input.minOrders,
      shipToCountry: input.shipToCountry ?? DEFAULT_SHIP_TO,
      page: input.page ?? DEFAULT_PAGE,
      pageSize: input.pageSize ?? DEFAULT_PAGE_SIZE,
      sortBy: input.sortBy,
    };
    return provider.search(query);
  }

  async getDetails(
    providerCode: string,
    externalId: string,
  ): Promise<SupplierProductDetail> {
    const provider = this.resolveProvider(providerCode);
    return provider.getDetails(externalId);
  }

  availableProviders(): readonly string[] {
    return this.registry.availableCodes();
  }

  private resolveProvider(code: string) {
    const available = this.registry.availableCodes();
    if (!available.includes(code as (typeof available)[number])) {
      throw new Error(`Unknown provider code "${code}"`);
    }
    return this.registry.get(code as (typeof available)[number]);
  }
}
