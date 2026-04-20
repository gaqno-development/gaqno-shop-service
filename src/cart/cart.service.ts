import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { carts, products, productVariations } from "../database/schema";
import { ShopDatabase } from "../database/shop-database.type";
import { AddCartItemDto, UpdateCartItemDto } from "./dto/cart.dto";

interface CartItem {
  productId: string;
  variationId?: string;
  name: string;
  quantity: number;
  price: number;
  imageUrl?: string;
  attributes?: Record<string, string>;
}

const CART_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function toCartItems(value: unknown): CartItem[] {
  return Array.isArray(value) ? (value as CartItem[]) : [];
}

function firstImageUrl(images: unknown): string | undefined {
  if (!Array.isArray(images) || images.length === 0) return undefined;
  const first = images[0];
  if (typeof first === "string") return first;
  if (typeof first === "object" && first !== null && "url" in first) {
    const { url } = first as { url?: unknown };
    return typeof url === "string" ? url : undefined;
  }
  return undefined;
}

@Injectable()
export class CartService {
  constructor(@Inject("DATABASE") private readonly db: ShopDatabase) {}

  async getCart(tenantId: string, sessionId?: string, customerId?: string) {
    if (!sessionId && !customerId) {
      throw new Error("Either sessionId or customerId is required");
    }
    const conditions = [eq(carts.tenantId, tenantId)];
    if (customerId) conditions.push(eq(carts.customerId, customerId));
    else conditions.push(eq(carts.sessionId, sessionId!));

    const cart = await this.db.query.carts.findFirst({
      where: and(...conditions),
    });
    if (cart) return cart;

    const [created] = await this.db
      .insert(carts)
      .values({
        tenantId,
        customerId,
        sessionId,
        items: [],
        expiresAt: new Date(Date.now() + CART_TTL_MS),
      })
      .returning();
    return created;
  }

  async addItem(
    tenantId: string,
    dto: AddCartItemDto,
    sessionId?: string,
    customerId?: string,
  ) {
    const cart = await this.getCart(tenantId, sessionId, customerId);
    const items = toCartItems(cart.items);
    const enriched = await this.buildItem(tenantId, dto);
    const idx = items.findIndex(
      (i) => i.productId === dto.productId && i.variationId === dto.variationId,
    );
    if (idx > -1) items[idx].quantity += dto.quantity;
    else items.push(enriched);
    await this.persistItems(cart.id, items);
    return this.getCart(tenantId, sessionId, customerId);
  }

  async updateItem(
    tenantId: string,
    productId: string,
    dto: UpdateCartItemDto,
    sessionId?: string,
    customerId?: string,
  ) {
    const cart = await this.getCart(tenantId, sessionId, customerId);
    const items = toCartItems(cart.items);
    const idx = items.findIndex((i) => i.productId === productId);
    if (idx === -1) throw new NotFoundException("Item not found in cart");
    if (dto.quantity <= 0) items.splice(idx, 1);
    else items[idx].quantity = dto.quantity;
    await this.persistItems(cart.id, items);
    return this.getCart(tenantId, sessionId, customerId);
  }

  removeItem(
    tenantId: string,
    productId: string,
    sessionId?: string,
    customerId?: string,
  ) {
    return this.updateItem(
      tenantId,
      productId,
      { quantity: 0 },
      sessionId,
      customerId,
    );
  }

  async clearCart(tenantId: string, sessionId?: string, customerId?: string) {
    const cart = await this.getCart(tenantId, sessionId, customerId);
    await this.persistItems(cart.id, []);
    return this.getCart(tenantId, sessionId, customerId);
  }

  async getCartSummary(
    tenantId: string,
    sessionId?: string,
    customerId?: string,
  ) {
    const cart = await this.getCart(tenantId, sessionId, customerId);
    const items = toCartItems(cart.items);
    return {
      itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
      uniqueItems: items.length,
      subtotal: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      items: items.map((i) => ({ ...i, total: i.price * i.quantity })),
    };
  }

  private async buildItem(
    tenantId: string,
    dto: AddCartItemDto,
  ): Promise<CartItem> {
    const product = await this.db.query.products.findFirst({
      where: and(
        eq(products.tenantId, tenantId),
        eq(products.id, dto.productId),
      ),
    });
    if (!product) throw new NotFoundException("Product not found");

    const variation = dto.variationId
      ? await this.db.query.productVariations.findFirst({
          where: and(
            eq(productVariations.tenantId, tenantId),
            eq(productVariations.id, dto.variationId),
          ),
        })
      : null;

    const price = variation?.price
      ? parseFloat(variation.price)
      : parseFloat(product.price);
    const name = variation?.name || product.name;
    const imageUrl = variation?.imageUrl ?? firstImageUrl(product.images);
    const attributes =
      typeof variation?.options === "object" && variation?.options !== null
        ? (variation.options as Record<string, string>)
        : undefined;

    return {
      productId: dto.productId,
      variationId: dto.variationId,
      name,
      quantity: dto.quantity,
      price,
      imageUrl,
      attributes,
    };
  }

  private async persistItems(cartId: string, items: CartItem[]): Promise<void> {
    await this.db
      .update(carts)
      .set({ items, updatedAt: new Date() })
      .where(eq(carts.id, cartId));
  }
}
