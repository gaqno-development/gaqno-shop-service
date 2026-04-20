export interface AliExpressConfig {
  readonly appKey: string;
  readonly appSecret: string;
  readonly baseUrl: string;
  readonly requestTimeoutMs: number;
}

export interface AliExpressRequest {
  readonly method: AliExpressApiMethod;
  readonly params: Record<string, string | number | boolean | undefined>;
}

export type AliExpressApiMethod =
  | "aliexpress.ds.product.search"
  | "aliexpress.ds.product.get"
  | "aliexpress.ds.order.create"
  | "aliexpress.ds.order.get"
  | "aliexpress.ds.order.cancel";

export interface AliExpressSuccessEnvelope<TBody> {
  readonly resp_result: {
    readonly resp_code: number;
    readonly resp_msg: string;
    readonly result: TBody;
  };
}

export interface AliExpressErrorEnvelope {
  readonly error_response: {
    readonly code: string | number;
    readonly msg: string;
    readonly sub_code?: string;
    readonly sub_msg?: string;
  };
}

export type AliExpressResponse<TBody> =
  | AliExpressSuccessEnvelope<TBody>
  | AliExpressErrorEnvelope;

export interface AliExpressProductSearchItem {
  readonly product_id: string;
  readonly subject: string;
  readonly product_main_image_url: string;
  readonly target_sale_price: string;
  readonly target_original_price?: string;
  readonly evaluate_rate?: string;
  readonly lastest_volume?: number;
  readonly store_name?: string;
  readonly ship_from_country?: string;
}

export interface AliExpressProductSearchResult {
  readonly total_count: number;
  readonly current_page_no: number;
  readonly page_size: number;
  readonly products: readonly AliExpressProductSearchItem[];
}

export interface AliExpressSkuOption {
  readonly ae_sku_property_id: string;
  readonly property_value_definition_name: string;
  readonly property_value_id_long: number;
  readonly sku_property_name: string;
}

export interface AliExpressSku {
  readonly sku_id: string;
  readonly sku_code?: string;
  readonly offer_sale_price: string;
  readonly sku_stock: number;
  readonly sku_image?: string;
  readonly ae_sku_property_dtos?: readonly AliExpressSkuOption[];
}

export interface AliExpressProductDetailResult {
  readonly ae_item_base_info_dto: {
    readonly product_id: string;
    readonly subject: string;
    readonly detail: string;
  };
  readonly ae_item_properties?: readonly {
    readonly attr_name: string;
    readonly attr_value: string;
  }[];
  readonly ae_multimedia_info_dto?: {
    readonly image_urls?: string;
  };
  readonly ae_item_sku_info_dtos?: readonly AliExpressSku[];
  readonly logistics_info_dto?: {
    readonly delivery_time_min?: number;
    readonly delivery_time_max?: number;
  };
  readonly package_info_dto?: Record<string, unknown>;
}

export interface AliExpressOrderCreateResult {
  readonly order_list?: readonly { readonly order_id: string }[];
  readonly error_code?: string;
  readonly error_msg?: string;
}

export interface AliExpressOrderGetResult {
  readonly order_status: string;
  readonly logistics_status?: string;
  readonly tracking_numbers?: readonly string[];
  readonly logistics_info?: readonly {
    readonly tracking_number?: string;
    readonly logistics_status?: string;
    readonly logistics_service_name?: string;
  }[];
}
