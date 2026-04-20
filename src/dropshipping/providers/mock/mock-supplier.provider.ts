import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  SupplierCancelResult,
  SupplierOrderRequest,
  SupplierOrderResult,
  SupplierProductDetail,
  SupplierProductSummary,
  SupplierProviderCode,
  SupplierSearchQuery,
  SupplierSearchResult,
  SupplierTrackingStatus,
  SupplierTrackingUpdate,
  SupplierVariation,
} from "@gaqno-development/types";
import type { SupplierProviderPort } from "../ports/supplier-provider.port";

interface MockOrderOutcome {
  readonly status: SupplierOrderResult["status"];
  readonly failureKind?: SupplierOrderResult["failureKind"];
  readonly failureReason?: string;
  readonly errorCode?: string;
}

interface MockTrackingOverride {
  readonly status: SupplierTrackingStatus;
  readonly trackingCode?: string;
  readonly trackingUrl?: string;
}

const MOCK_CATALOG: readonly SupplierProductSummary[] = buildMockCatalog();

function buildMockCatalog(): readonly SupplierProductSummary[] {
  const items = [
    { id: "mock-1", title: "Camiseta básica oversized", min: 8, max: 14 },
    { id: "mock-2", title: "Camiseta estampada vintage", min: 12, max: 18 },
    { id: "mock-3", title: "Fone bluetooth TWS", min: 15, max: 25 },
    { id: "mock-4", title: "Relógio smart pulseira", min: 22, max: 38 },
    { id: "mock-5", title: "Mochila impermeável 20L", min: 28, max: 45 },
    { id: "mock-6", title: "Camiseta polo slim", min: 11, max: 16 },
    { id: "mock-7", title: "Luminária LED mesa", min: 18, max: 30 },
    { id: "mock-8", title: "Copo térmico 500ml", min: 9, max: 15 },
  ] as const;

  return items.map((item, idx) => ({
    providerCode: "aliexpress",
    externalId: item.id,
    title: item.title,
    thumbnailUrl: `https://cdn.mock/${item.id}.jpg`,
    priceUsd: { min: item.min, max: item.max },
    rating: 4 + ((idx % 10) / 10),
    ordersCount: 100 + idx * 37,
    sellerName: `MockSeller ${(idx % 3) + 1}`,
    shipsFromCountry: "CN",
  }));
}

function buildDetail(summary: SupplierProductSummary): SupplierProductDetail {
  const variations: SupplierVariation[] = [
    {
      externalId: `${summary.externalId}-v1`,
      sku: `${summary.externalId}-SKU-1`,
      priceUsd: summary.priceUsd.min,
      stock: 50,
      attributes: { color: "preto", size: "M" },
    },
    {
      externalId: `${summary.externalId}-v2`,
      sku: `${summary.externalId}-SKU-2`,
      priceUsd: summary.priceUsd.max,
      stock: 30,
      attributes: { color: "branco", size: "G" },
    },
  ];

  return {
    ...summary,
    description: `Mock description for ${summary.title}`,
    images: [
      summary.thumbnailUrl,
      summary.thumbnailUrl.replace(".jpg", "-2.jpg"),
    ],
    variations,
    attributes: { brand: "MockBrand" },
    estimatedDeliveryDays: { min: 15, max: 40 },
  };
}

function matchesQuery(
  summary: SupplierProductSummary,
  query: SupplierSearchQuery,
): boolean {
  if (query.keyword) {
    const needle = query.keyword.toLowerCase();
    if (!summary.title.toLowerCase().includes(needle)) return false;
  }
  if (query.minPriceUsd !== undefined && summary.priceUsd.min < query.minPriceUsd) {
    return false;
  }
  if (query.maxPriceUsd !== undefined && summary.priceUsd.max > query.maxPriceUsd) {
    return false;
  }
  if (query.minRating !== undefined && summary.rating < query.minRating) {
    return false;
  }
  if (query.minOrders !== undefined && summary.ordersCount < query.minOrders) {
    return false;
  }
  return true;
}

@Injectable()
export class MockSupplierProvider implements SupplierProviderPort {
  readonly code: SupplierProviderCode = "aliexpress";

  private nextOrderOutcome: MockOrderOutcome | null = null;
  private readonly trackingOverrides = new Map<string, MockTrackingOverride>();
  private orderCounter = 0;

  configureNextOrderOutcome(outcome: MockOrderOutcome): void {
    this.nextOrderOutcome = outcome;
  }

  configureTracking(externalOrderId: string, override: MockTrackingOverride): void {
    this.trackingOverrides.set(externalOrderId, override);
  }

  async search(query: SupplierSearchQuery): Promise<SupplierSearchResult> {
    const filtered = MOCK_CATALOG.filter((item) => matchesQuery(item, query));
    const start = (query.page - 1) * query.pageSize;
    const items = filtered.slice(start, start + query.pageSize);
    return {
      items,
      total: filtered.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getDetails(externalId: string): Promise<SupplierProductDetail> {
    const summary = MOCK_CATALOG.find((item) => item.externalId === externalId);
    if (!summary) {
      throw new NotFoundException(`Mock product ${externalId} not found`);
    }
    return buildDetail(summary);
  }

  async placeOrder(
    request: SupplierOrderRequest,
  ): Promise<SupplierOrderResult> {
    const outcome = this.nextOrderOutcome;
    this.nextOrderOutcome = null;

    if (outcome && outcome.status === "failed") {
      return {
        externalOrderId: "",
        status: "failed",
        failureKind: outcome.failureKind,
        failureReason: outcome.failureReason,
        errorCode: outcome.errorCode,
      };
    }

    this.orderCounter += 1;
    const externalOrderId = `MOCK-${Date.now()}-${this.orderCounter}`;
    return {
      externalOrderId,
      status: "placed",
      placedAt: new Date().toISOString(),
    };
  }

  async getTracking(externalOrderId: string): Promise<SupplierTrackingUpdate> {
    const override = this.trackingOverrides.get(externalOrderId);
    const status: SupplierTrackingStatus = override?.status ?? "processing";

    return {
      externalOrderId,
      status,
      trackingCode: override?.trackingCode,
      trackingUrl: override?.trackingUrl,
      events: [
        {
          timestamp: new Date(),
          description: `Mock status: ${status}`,
        },
      ],
    };
  }

  async cancelOrder(
    _externalOrderId: string,
    _reason: string,
  ): Promise<SupplierCancelResult> {
    return { success: true };
  }
}
