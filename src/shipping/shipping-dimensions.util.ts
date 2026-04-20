import {
  ProductWeightDimensions,
  ShippingDimensions,
  ShippingItem,
} from "./shipping.types";

const DEFAULT_LENGTH_CM = 16;
const DEFAULT_WIDTH_CM = 11;
const DEFAULT_HEIGHT_CM = 2;
const DEFAULT_WEIGHT_KG = 0.5;
const MAX_WEIGHT_KG = 30;
const MIN_WEIGHT_KG = 0.3;
const MAX_DIM_CM = 105;
const ENVELOPE_CAP_CM = 100;

interface AttributesWithDims {
  length?: number;
  width?: number;
  height?: number;
}

function extractAttributeDims(attributes: unknown): AttributesWithDims {
  if (typeof attributes !== "object" || attributes === null) return {};
  const source = attributes as Record<string, unknown>;
  const toNumber = (v: unknown) => (typeof v === "number" ? v : undefined);
  return {
    length: toNumber(source.length),
    width: toNumber(source.width),
    height: toNumber(source.height),
  };
}

export function calculateTotalDimensions(
  items: readonly ShippingItem[],
  productData: readonly ProductWeightDimensions[],
): ShippingDimensions {
  let totalWeight = 0;
  let maxLength = 0;
  let maxWidth = 0;
  let maxHeight = 0;
  let volume = 0;

  for (const item of items) {
    const product = productData.find((p) => p.id === item.productId);
    if (!product) continue;

    const weight = parseFloat(product.weight ?? "0") || DEFAULT_WEIGHT_KG;
    const quantity = item.quantity;
    totalWeight += weight * quantity;

    const dims = extractAttributeDims(product.attributes);
    const length = dims.length ?? DEFAULT_LENGTH_CM;
    const width = dims.width ?? DEFAULT_WIDTH_CM;
    const height = dims.height ?? DEFAULT_HEIGHT_CM;

    volume += length * width * height * quantity;
    maxLength = Math.max(maxLength, length);
    maxWidth = Math.max(maxWidth, width);
    maxHeight = Math.max(maxHeight, height);
  }

  totalWeight = Math.min(totalWeight, MAX_WEIGHT_KG);
  const cubicRoot = Math.cbrt(volume);
  const estimatedLength = Math.max(maxLength, Math.min(cubicRoot * 1.2, ENVELOPE_CAP_CM));
  const estimatedWidth = Math.max(maxWidth, Math.min(cubicRoot, ENVELOPE_CAP_CM));
  const estimatedHeight = Math.max(
    maxHeight,
    Math.min(volume / (estimatedLength * estimatedWidth), ENVELOPE_CAP_CM),
  );

  return {
    weight: Math.max(totalWeight, MIN_WEIGHT_KG),
    length: Math.min(estimatedLength, MAX_DIM_CM),
    width: Math.min(estimatedWidth, MAX_DIM_CM),
    height: Math.min(estimatedHeight, MAX_DIM_CM),
  };
}
