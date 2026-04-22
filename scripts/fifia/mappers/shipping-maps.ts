import { normalizeCep } from "./customer-maps";

export interface FifiaShippingZone {
  id: string;
  name: string;
  zipStart: string;
  zipEnd: string;
  fixedPrice: string | number;
  pricePerKm: string | number;
  isActive: boolean;
}

export interface ShippingMethodDraft {
  name: string;
  slug: string;
  carrier: "local";
  is_active: boolean;
  flat_rate: string;
  handling_days: number;
  settings: {
    sourceZoneId: string;
    zipStart: string;
    zipEnd: string;
    pricePerKm: string;
  };
}

function coercePrice(price: string | number): string {
  const n = typeof price === "number" ? price : Number(price);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}

export function zoneSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function zoneToShippingMethod(
  zone: FifiaShippingZone,
): ShippingMethodDraft {
  return {
    name: zone.name,
    slug: zoneSlug(zone.name),
    carrier: "local",
    is_active: zone.isActive,
    flat_rate: coercePrice(zone.fixedPrice),
    handling_days: 1,
    settings: {
      sourceZoneId: zone.id,
      zipStart: normalizeCep(zone.zipStart),
      zipEnd: normalizeCep(zone.zipEnd),
      pricePerKm: coercePrice(zone.pricePerKm),
    },
  };
}
