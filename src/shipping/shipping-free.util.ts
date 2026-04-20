import { ShippingMethodRow } from "./shipping.types";

const PREMIUM_TIERS = new Set(["silver", "gold", "platinum"]);
const PREMIUM_FREE_SHIPPING_THRESHOLD = 99;

export function qualifiesForFreeShipping(
  method: ShippingMethodRow,
  subtotal: number,
  customerTier?: string,
): boolean {
  const tier = customerTier?.toLowerCase();
  if (tier && PREMIUM_TIERS.has(tier) && subtotal >= PREMIUM_FREE_SHIPPING_THRESHOLD) {
    return true;
  }
  if (
    method.freeShippingThreshold &&
    subtotal >= parseFloat(method.freeShippingThreshold)
  ) {
    return true;
  }
  return false;
}
