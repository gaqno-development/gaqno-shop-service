import { Injectable } from "@nestjs/common";
import type {
  SupplierCancelResult,
  SupplierOrderRequest,
  SupplierOrderResult,
  SupplierProductDetail,
  SupplierProviderCode,
  SupplierSearchQuery,
  SupplierSearchResult,
  SupplierTrackingUpdate,
} from "@gaqno-development/types";
import type { SupplierProviderPort } from "../ports/supplier-provider.port";
import { AliExpressApiError, AliExpressClient } from "./aliexpress-client";
import {
  toDetail,
  toOrderCreatePayload,
  toSummary,
  toTrackingUpdate,
} from "./aliexpress.mapper";
import type {
  AliExpressOrderCreateResult,
  AliExpressOrderGetResult,
  AliExpressProductDetailResult,
  AliExpressProductSearchResult,
} from "./aliexpress.types";

const SORT_MAP: Readonly<Record<string, string>> = {
  relevance: "",
  orders: "LAST_VOLUME_DESC",
  price_asc: "SALE_PRICE_ASC",
  price_desc: "SALE_PRICE_DESC",
  rating: "",
};

@Injectable()
export class AliExpressProvider implements SupplierProviderPort {
  readonly code: SupplierProviderCode = "aliexpress";

  constructor(private readonly client: AliExpressClient) {}

  async search(query: SupplierSearchQuery): Promise<SupplierSearchResult> {
    const result = await this.client.call<AliExpressProductSearchResult>({
      method: "aliexpress.ds.product.search",
      params: {
        keyword: query.keyword,
        category_id: query.categoryId,
        ship_to_country: query.shipToCountry,
        min_sale_price: query.minPriceUsd,
        max_sale_price: query.maxPriceUsd,
        page_no: query.page,
        page_size: query.pageSize,
        sort: query.sortBy ? SORT_MAP[query.sortBy] : undefined,
        target_currency: "USD",
        target_language: "pt",
      },
    });

    return {
      items: result.products.map(toSummary),
      total: result.total_count,
      page: result.current_page_no,
      pageSize: result.page_size,
    };
  }

  async getDetails(externalId: string): Promise<SupplierProductDetail> {
    const result = await this.client.call<AliExpressProductDetailResult>({
      method: "aliexpress.ds.product.get",
      params: {
        product_id: externalId,
        ship_to_country: "BR",
        target_currency: "USD",
        target_language: "pt",
      },
    });
    return toDetail(result);
  }

  async placeOrder(
    request: SupplierOrderRequest,
  ): Promise<SupplierOrderResult> {
    try {
      const result = await this.client.call<AliExpressOrderCreateResult>({
        method: "aliexpress.ds.order.create",
        params: toOrderCreatePayload(request),
      });
      const first = result.order_list?.[0];
      if (!first) {
        return {
          externalOrderId: "",
          status: "failed",
          failureKind: "unknown",
          failureReason: result.error_msg ?? "empty order_list",
          errorCode: result.error_code,
        };
      }
      return {
        externalOrderId: first.order_id,
        status: "placed",
        placedAt: new Date().toISOString(),
      };
    } catch (error) {
      return this.toFailure(error);
    }
  }

  async getTracking(externalOrderId: string): Promise<SupplierTrackingUpdate> {
    const result = await this.client.call<AliExpressOrderGetResult>({
      method: "aliexpress.ds.order.get",
      params: { order_id: externalOrderId },
    });
    return toTrackingUpdate(externalOrderId, result);
  }

  async cancelOrder(
    externalOrderId: string,
    reason: string,
  ): Promise<SupplierCancelResult> {
    try {
      await this.client.call({
        method: "aliexpress.ds.order.cancel",
        params: { order_id: externalOrderId, cancel_reason: reason },
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private toFailure(error: unknown): SupplierOrderResult {
    if (error instanceof AliExpressApiError) {
      return {
        externalOrderId: "",
        status: "failed",
        failureKind: classifyError(error.subCode ?? error.code),
        failureReason: error.message,
        errorCode: error.code,
      };
    }
    return {
      externalOrderId: "",
      status: "failed",
      failureKind: "transient",
      failureReason: error instanceof Error ? error.message : String(error),
    };
  }
}

function classifyError(
  code: string | undefined,
): SupplierOrderResult["failureKind"] {
  if (!code) return "unknown";
  const normalized = code.toLowerCase();
  if (normalized.includes("stock")) return "out_of_stock";
  if (normalized.includes("address")) return "address_invalid";
  if (normalized.includes("payment")) return "payment_rejected";
  if (normalized.includes("policy") || normalized.includes("forbid")) {
    return "policy_violation";
  }
  if (
    normalized.includes("timeout") ||
    normalized.includes("rate") ||
    normalized.includes("limit")
  ) {
    return "transient";
  }
  return "unknown";
}
