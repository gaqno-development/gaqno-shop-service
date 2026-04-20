import { Injectable } from "@nestjs/common";
import type { SupplierProviderCode } from "@gaqno-development/types";
import type { SupplierProviderPort } from "./ports/supplier-provider.port";

@Injectable()
export class ProviderRegistry {
  private readonly providers: ReadonlyMap<SupplierProviderCode, SupplierProviderPort>;

  constructor(providers: readonly SupplierProviderPort[]) {
    const map = new Map<SupplierProviderCode, SupplierProviderPort>();
    providers.forEach((provider) => {
      if (map.has(provider.code)) {
        throw new Error(`Duplicate supplier provider for code "${provider.code}"`);
      }
      map.set(provider.code, provider);
    });
    this.providers = map;
  }

  get(code: SupplierProviderCode): SupplierProviderPort {
    const provider = this.providers.get(code);
    if (!provider) {
      throw new Error(`Unknown supplier provider code "${code}"`);
    }
    return provider;
  }

  availableCodes(): SupplierProviderCode[] {
    return Array.from(this.providers.keys());
  }
}
