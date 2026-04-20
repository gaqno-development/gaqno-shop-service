import type {
  SupplierOrderRequest,
  SupplierProductDetail,
  SupplierProductSummary,
  SupplierTrackingStatus,
  SupplierTrackingUpdate,
  SupplierVariation,
} from "@gaqno-development/types";
import type {
  AliExpressOrderGetResult,
  AliExpressProductDetailResult,
  AliExpressProductSearchItem,
  AliExpressSku,
  AliExpressSkuOption,
} from "./aliexpress.types";

const TRACKING_STATUS_MAP: Readonly<Record<string, SupplierTrackingStatus>> = {
  WAIT_SELLER_SEND_GOODS: "processing",
  SELLER_PART_SEND_GOODS: "processing",
  WAIT_BUYER_ACCEPT_GOODS: "in_transit",
  FUND_PROCESSING: "in_transit",
  FINISH: "delivered",
  IN_CANCEL: "exception",
  RISK_CONTROL: "exception",
  SELLER_SEND_GOODS: "shipped",
};

export function toSummary(
  item: AliExpressProductSearchItem,
): SupplierProductSummary {
  const price = parseFloat(item.target_sale_price);
  const original = item.target_original_price
    ? parseFloat(item.target_original_price)
    : price;
  return {
    providerCode: "aliexpress",
    externalId: item.product_id,
    title: item.subject,
    thumbnailUrl: item.product_main_image_url,
    priceUsd: {
      min: Math.min(price, original),
      max: Math.max(price, original),
    },
    rating: item.evaluate_rate ? parseFloat(item.evaluate_rate) : 0,
    ordersCount: item.lastest_volume ?? 0,
    sellerName: item.store_name ?? "",
    shipsFromCountry: item.ship_from_country ?? "CN",
  };
}

export function toDetail(
  detail: AliExpressProductDetailResult,
): SupplierProductDetail {
  const base = detail.ae_item_base_info_dto;
  const skus = detail.ae_item_sku_info_dtos ?? [];
  const prices = skus
    .map((sku) => parseFloat(sku.offer_sale_price))
    .filter((n) => !Number.isNaN(n));
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : minPrice;
  const images = (detail.ae_multimedia_info_dto?.image_urls ?? "")
    .split(";")
    .map((url) => url.trim())
    .filter((url) => url.length > 0);

  return {
    providerCode: "aliexpress",
    externalId: base.product_id,
    title: base.subject,
    thumbnailUrl: images[0] ?? "",
    priceUsd: { min: minPrice, max: maxPrice },
    rating: 0,
    ordersCount: 0,
    sellerName: "",
    shipsFromCountry: "CN",
    description: base.detail,
    images,
    variations: skus.map(toVariation),
    attributes: toAttributes(detail.ae_item_properties),
    estimatedDeliveryDays: {
      min: detail.logistics_info_dto?.delivery_time_min ?? 15,
      max: detail.logistics_info_dto?.delivery_time_max ?? 40,
    },
  };
}

function toVariation(sku: AliExpressSku): SupplierVariation {
  return {
    externalId: sku.sku_id,
    sku: sku.sku_code ?? sku.sku_id,
    priceUsd: parseFloat(sku.offer_sale_price),
    stock: sku.sku_stock,
    attributes: toSkuAttributes(sku.ae_sku_property_dtos),
    imageUrl: sku.sku_image,
  };
}

function toSkuAttributes(
  options: readonly AliExpressSkuOption[] | undefined,
): Record<string, string> {
  if (!options) return {};
  return options.reduce<Record<string, string>>((acc, opt) => {
    acc[opt.sku_property_name] = opt.property_value_definition_name;
    return acc;
  }, {});
}

function toAttributes(
  properties: readonly { attr_name: string; attr_value: string }[] | undefined,
): Record<string, string> {
  if (!properties) return {};
  return properties.reduce<Record<string, string>>((acc, prop) => {
    acc[prop.attr_name] = prop.attr_value;
    return acc;
  }, {});
}

export function toOrderCreatePayload(
  request: SupplierOrderRequest,
): Record<string, string> {
  const address = request.shippingAddress;
  return {
    product_id: request.externalProductId,
    product_count: String(request.quantity),
    logistics_service_name: "CAINIAO_STANDARD",
    out_order_id: request.referenceId ?? "",
    sku_attr: request.externalVariationId ?? "",
    address: JSON.stringify({
      contact_person: address.fullName,
      phone_country: "+55",
      mobile_no: address.phone,
      email: address.email,
      address: `${address.street}, ${address.number}${
        address.complement ? ` (${address.complement})` : ""
      }`,
      address2: address.neighborhood,
      city: address.city,
      province: address.stateCode,
      country: address.countryCode,
      zip: address.postalCode,
      tax_number: request.buyerTaxNumber,
    }),
  };
}

export function toTrackingUpdate(
  externalOrderId: string,
  result: AliExpressOrderGetResult,
): SupplierTrackingUpdate {
  const status: SupplierTrackingStatus =
    TRACKING_STATUS_MAP[result.order_status] ?? "processing";
  const firstLog = result.logistics_info?.[0];
  return {
    externalOrderId,
    status,
    trackingCode: firstLog?.tracking_number ?? result.tracking_numbers?.[0],
    events: [
      {
        timestamp: new Date(),
        description: firstLog?.logistics_status ?? result.order_status,
      },
    ],
  };
}
