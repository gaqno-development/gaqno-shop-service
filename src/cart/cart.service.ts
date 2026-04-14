import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import { carts, products, productVariations } from "../database/schema";
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

@Injectable()
export class CartService {
  constructor(@Inject("DATABASE") private db: any) {}

  async getCart(tenantId: string, sessionId?: string, customerId?: string) {
    if (!sessionId && !customerId) {
      throw new Error("Either sessionId or customerId is required");
    }

    const conditions = [eq(carts.tenantId, tenantId)];
    
    if (customerId) {
      conditions.push(eq(carts.customerId, customerId));
    } else {
      conditions.push(eq(carts.sessionId, sessionId!));
    }

    let cart = await this.db.query.carts.findFirst({
      where: and(...conditions),
    });

    if (!cart) {
      // Create new cart
      const [newCart] = await this.db
        .insert(carts)
        .values({
          tenantId,
          customerId,
          sessionId,
          items: [],
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        })
        .returning();
      cart = newCart;
    }

    return cart;
  }

  async addItem(
    tenantId: string,
    dto: AddCartItemDto,
    sessionId?: string,
    customerId?: string
  ) {
    const cart = await this.getCart(tenantId, sessionId, customerId);
    const items: CartItem[] = (cart.items as CartItem[]) || [];

    // Get product details
    const product = await this.db.query.products.findFirst({
      where: and(eq(products.tenantId, tenantId), eq(products.id, dto.productId)),
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    let variation = null;
    if (dto.variationId) {
      variation = await this.db.query.productVariations.findFirst({
        where: and(
          eq(productVariations.tenantId, tenantId),
          eq(productVariations.id, dto.variationId)
        ),
      });
    }

    const price = variation?.price ? parseFloat(variation.price) : parseFloat(product.price);
    const itemName = variation?.name || product.name;
    const imageUrl = variation?.imageUrl || (product.images as string[])?.[0];

    // Check if item already exists in cart
    const existingItemIndex = items.findIndex(
      (item) =>
        item.productId === dto.productId && item.variationId === dto.variationId
    );

    if (existingItemIndex > -1) {
      // Update quantity
      items[existingItemIndex].quantity += dto.quantity;
    } else {
      // Add new item
      items.push({
        productId: dto.productId,
        variationId: dto.variationId,
        name: itemName,
        quantity: dto.quantity,
        price,
        imageUrl,
        attributes: variation?.options as Record<string, string>,
      });
    }

    // Update cart
    await this.db
      .update(carts)
      .set({
        items,
        updatedAt: new Date(),
      })
      .where(eq(carts.id, cart.id));

    return this.getCart(tenantId, sessionId, customerId);
  }

  async updateItem(
    tenantId: string,
    productId: string,
    dto: UpdateCartItemDto,
    sessionId?: string,
    customerId?: string
  ) {
    const cart = await this.getCart(tenantId, sessionId, customerId);
    const items: CartItem[] = (cart.items as CartItem[]) || [];

    const itemIndex = items.findIndex((item) => item.productId === productId);

    if (itemIndex === -1) {
      throw new NotFoundException("Item not found in cart");
    }

    if (dto.quantity <= 0) {
      // Remove item
      items.splice(itemIndex, 1);
    } else {
      // Update quantity
      items[itemIndex].quantity = dto.quantity;
    }

    await this.db
      .update(carts)
      .set({
        items,
        updatedAt: new Date(),
      })
      .where(eq(carts.id, cart.id));

    return this.getCart(tenantId, sessionId, customerId);
  }

  async removeItem(
    tenantId: string,
    productId: string,
    sessionId?: string,
    customerId?: string
  ) {
    return this.updateItem(
      tenantId,
      productId,
      { quantity: 0 },
      sessionId,
      customerId
    );
  }

  async clearCart(tenantId: string, sessionId?: string, customerId?: string) {
    const cart = await this.getCart(tenantId, sessionId, customerId);

    await this.db
      .update(carts)
      .set({
        items: [],
        updatedAt: new Date(),
      })
      .where(eq(carts.id, cart.id));

    return this.getCart(tenantId, sessionId, customerId);
  }

  async getCartSummary(tenantId: string, sessionId?: string, customerId?: string) {
    const cart = await this.getCart(tenantId, sessionId, customerId);
    const items: CartItem[] = (cart.items as CartItem[]) || [];

    const summary = {
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      uniqueItems: items.length,
      subtotal: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      items: items.map((item) => ({
        ...item,
        total: item.price * item.quantity,
      })),
    };

    return summary;
  }
}
