import { normalizeCep } from "./customer-maps";

export interface FifiaShippingZone {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  minDeliveryDays: number | null;
  maxDeliveryDays: number | null;
  ceps: readonly string[];
  active: boolean;
}

export interface ShippingMethodDraft {
  name: string;
  description: string;
  type: "delivery";
  price: string;
  minDeliveryDays: number | null;
  maxDeliveryDays: number | null;
  active: boolean;
  settings: {
    sourceZoneId: string;
    ceps: string[];
  };
}

function coercePrice(price: string | number): string {
  const n = typeof price === "number" ? price : Number(price);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}

export function zoneToShippingMethod(
  zone: FifiaShippingZone,
): ShippingMethodDraft {
  const ceps = zone.ceps
    .map((c) => normalizeCep(c))
    .filter((c) => c.length > 0);

  return {
    name: zone.name,
    description: zone.description ?? "",
    type: "delivery",
    price: coercePrice(zone.price),
    minDeliveryDays: zone.minDeliveryDays,
    maxDeliveryDays: zone.maxDeliveryDays,
    active: zone.active,
    settings: {
      sourceZoneId: zone.id,
      ceps,
    },
  };
}
