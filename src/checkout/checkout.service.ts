import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import {
  decorations,
  productVariations,
  products,
} from "../database/schema";
import { ShopDatabase } from "../database/shop-database.type";
import { OrderCreateService } from "../order/order-create.service";
import { CreateOrderDto } from "../order/dto/order.dto";
import { ShippingCalculatorService } from "../shipping/shipping-calculator.service";
import { CouponsService } from "../coupons/coupons.service";
import { CheckoutRequestDto } from "./dto/checkout.dto";

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class CheckoutService {
  constructor(
    @Inject("DATABASE") private readonly db: ShopDatabase,
    private readonly orderCreate: OrderCreateService,
    private readonly shippingCalculator: ShippingCalculatorService,
    private readonly coupons: CouponsService,
  ) {}

  async checkout(
    tenantId: string,
    tenantSlug: string,
    dto: CheckoutRequestDto,
  ) {
    const cep = dto.shippingAddress.cep.replace(/\D/g, "");
    if (cep.length < 8) {
      throw new BadRequestException("Invalid CEP");
    }

    const productIds = [...new Set(dto.items.map((i) => i.productId))];
    const productRows = await this.db.query.products.findMany({
      where: and(eq(products.tenantId, tenantId), inArray(products.id, productIds)),
    });
    const byProductId = new Map(productRows.map((p) => [p.id, p]));
    for (const id of productIds) {
      if (!byProductId.has(id)) {
        throw new BadRequestException(`Product not found: ${id}`);
      }
      const p = byProductId.get(id)!;
      if (!p.isActive) {
        throw new BadRequestException(`Product inactive: ${id}`);
      }
    }

    const variationIds = [
      ...new Set(
        dto.items.map((i) => i.variationId).filter((v): v is string => Boolean(v)),
      ),
    ];
    const variationRows =
      variationIds.length > 0
        ? await this.db.query.productVariations.findMany({
            where: and(
              eq(productVariations.tenantId, tenantId),
              inArray(productVariations.id, variationIds),
            ),
          })
        : [];
    const byVariationId = new Map(variationRows.map((v) => [v.id, v]));

    const allDecorationIds = [
      ...new Set(
        dto.items.flatMap((line) =>
          (line.decorations ?? []).map((d) => d.decorationId),
        ),
      ),
    ];
    const decorationRows =
      allDecorationIds.length > 0
        ? await this.db.query.decorations.findMany({
            where: and(
              eq(decorations.tenantId, tenantId),
              inArray(decorations.id, allDecorationIds),
            ),
          })
        : [];
    const decorationPriceById = new Map(
      decorationRows.map((d) => [d.id, Number(d.price)]),
    );
    for (const id of allDecorationIds) {
      if (!decorationPriceById.has(id)) {
        throw new BadRequestException(`Decoration not found: ${id}`);
      }
    }

    const resolvedItems: CreateOrderDto["items"] = [];
    let subtotal = 0;

    for (const line of dto.items) {
      const product = byProductId.get(line.productId)!;
      let baseUnit = Number(product.price);
      let displayName = product.name;
      let imageUrl: string | undefined;
      const imgs = product.images;
      if (Array.isArray(imgs) && imgs.length > 0) {
        const first = imgs[0];
        imageUrl =
          typeof first === "string"
            ? first
            : first &&
                typeof first === "object" &&
                "url" in first &&
                typeof (first as { url: unknown }).url === "string"
              ? String((first as { url: string }).url)
              : undefined;
      }

      if (line.variationId) {
        const variation = byVariationId.get(line.variationId);
        if (!variation || variation.productId !== line.productId) {
          throw new BadRequestException("Invalid variation for product");
        }
        if (!variation.isActive) {
          throw new BadRequestException("Variation inactive");
        }
        if (variation.price != null && String(variation.price).trim() !== "") {
          baseUnit = Number(variation.price);
        }
        displayName = `${product.name} — ${variation.name}`;
        if (variation.imageUrl) {
          imageUrl = variation.imageUrl;
        }
      }

      let decoPerCake = 0;
      for (const pick of line.decorations ?? []) {
        const unitDeco = decorationPriceById.get(pick.decorationId) ?? 0;
        decoPerCake += unitDeco * pick.quantity;
      }

      const unitPrice = roundMoney(baseUnit + decoPerCake);
      const lineTotal = roundMoney(unitPrice * line.quantity);
      subtotal += lineTotal;

      const flatDecorations = (line.decorations ?? []).flatMap((pick) =>
        Array.from({ length: pick.quantity }, () => ({
          decorationId: pick.decorationId,
        })),
      );

      const ref = line.referenceImageUrl?.trim();
      const referenceImageUrl =
        ref && /^https:\/\//i.test(ref) ? ref : undefined;

      resolvedItems.push({
        productId: line.productId,
        variationId: line.variationId,
        name: displayName,
        quantity: line.quantity,
        price: unitPrice,
        imageUrl,
        size: line.size,
        notes: line.notes,
        referenceImageUrl,
        decorations: flatDecorations.length > 0 ? flatDecorations : undefined,
      });
    }

    subtotal = roundMoney(subtotal);

    let discountAmount = 0;
    const trimmedCoupon = dto.couponCode?.trim();
    if (trimmedCoupon) {
      const couponResult = await this.coupons.validate(
        tenantId,
        trimmedCoupon,
        subtotal,
      );
      if (!couponResult.valid) {
        throw new BadRequestException("Invalid or inapplicable coupon");
      }
      discountAmount = roundMoney(couponResult.discount);
    }

    const shippingItems = dto.items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
    }));

    const rates = await this.shippingCalculator.calculateShipping(
      tenantId,
      cep,
      shippingItems,
      subtotal,
    );
    const chosen = rates.find((r) => r.methodId === dto.shippingMethodId);
    if (!chosen) {
      throw new BadRequestException("Shipping method not available for this CEP");
    }

    const shippingAmount = roundMoney(chosen.price);
    const total = roundMoney(subtotal - discountAmount + shippingAmount);
    if (total < 0) {
      throw new BadRequestException("Invalid order total");
    }

    const createDto: CreateOrderDto = {
      items: resolvedItems,
      shippingAddress: dto.shippingAddress,
      billingAddress: dto.billingAddress,
      customerNotes: dto.customerNotes,
      customerId: dto.customerId,
      sessionId: dto.sessionId,
      deliveryDate: dto.deliveryDate,
      deliveryTime: dto.deliveryTime,
      deliveryIsPickup: dto.deliveryIsPickup,
      couponCode: trimmedCoupon,
      shippingMethodId: dto.shippingMethodId,
    };

    const totals = { subtotal, shippingAmount, discountAmount, total };
    return this.orderCreate.createWithTotals(
      tenantId,
      tenantSlug,
      createDto,
      totals,
    );
  }
}
