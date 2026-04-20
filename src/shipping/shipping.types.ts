export interface ShippingItem {
  productId: string;
  quantity: number;
}

export interface ShippingDimensions {
  weight: number;
  length: number;
  width: number;
  height: number;
}

export interface ProductWeightDimensions {
  id: string;
  weight: string | null;
  attributes: unknown;
}

export interface CalculatedRate {
  methodId: string;
  name: string;
  carrier: string;
  price: number;
  originalPrice?: number;
  days: { min: number; max: number };
  isFreeShipping: boolean;
}

export interface ShippingMethodRow {
  id: string;
  name: string;
  carrier: string;
  serviceCode: string | null;
  flatRate: string | null;
  freeShippingThreshold: string | null;
  estimatedDeliveryDaysMin: number | null;
  estimatedDeliveryDaysMax: number | null;
  settings?: { originCep?: string } | null;
}
