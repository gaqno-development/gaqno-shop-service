import { Injectable } from "@nestjs/common";
import { and, desc, eq, inArray } from "drizzle-orm";
import { DrizzleService } from "../database/drizzle.service";
import { products, wishlistItems, wishlists } from "../database/schema";
import {
  WishlistItemDetail,
  isProductImageArray,
} from "./wishlist.types";

const DEFAULT_WISHLIST_NAME = "Favoritos";

@Injectable()
export class WishlistItemsService {
  constructor(private readonly drizzle: DrizzleService) {}

  async listItems(wishlistId: string): Promise<WishlistItemDetail[]> {
    const items = await this.drizzle.db.query.wishlistItems.findMany({
      where: eq(wishlistItems.wishlistId, wishlistId),
      orderBy: [desc(wishlistItems.createdAt)],
    });
    if (items.length === 0) return [];

    const productIds = items.map((i) => i.productId);
    const productData = await this.drizzle.db.query.products.findMany({
      where: inArray(products.id, productIds),
    });
    const productMap = new Map(productData.map((p) => [p.id, p]));

    return items.map((item) => this.mapItemDetail(item, productMap.get(item.productId)));
  }

  async addItem(
    tenantId: string,
    customerId: string,
    productId: string,
    wishlistId?: string,
  ) {
    const wishlist = await this.resolveWishlist(tenantId, customerId, wishlistId);
    const existing = await this.drizzle.db.query.wishlistItems.findFirst({
      where: and(
        eq(wishlistItems.wishlistId, wishlist.id),
        eq(wishlistItems.productId, productId),
      ),
    });
    if (existing) {
      return { success: true, message: "Produto já está na lista" };
    }

    await this.drizzle.db
      .insert(wishlistItems)
      .values({ wishlistId: wishlist.id, productId });
    await this.drizzle.db
      .update(wishlists)
      .set({ updatedAt: new Date() })
      .where(eq(wishlists.id, wishlist.id));

    return { success: true, message: "Produto adicionado à lista" };
  }

  async removeItem(wishlistId: string, itemId: string, customerId: string) {
    const wishlist = await this.drizzle.db.query.wishlists.findFirst({
      where: and(
        eq(wishlists.id, wishlistId),
        eq(wishlists.customerId, customerId),
      ),
    });
    if (!wishlist) throw new Error("Lista não encontrada");

    await this.drizzle.db
      .delete(wishlistItems)
      .where(
        and(
          eq(wishlistItems.id, itemId),
          eq(wishlistItems.wishlistId, wishlistId),
        ),
      );
    return { success: true, message: "Produto removido da lista" };
  }

  async hasProduct(
    tenantId: string,
    customerId: string,
    productId: string,
  ): Promise<boolean> {
    const wishlist = await this.getDefaultWishlist(tenantId, customerId);
    const item = await this.drizzle.db.query.wishlistItems.findFirst({
      where: and(
        eq(wishlistItems.wishlistId, wishlist.id),
        eq(wishlistItems.productId, productId),
      ),
    });
    return Boolean(item);
  }

  private async resolveWishlist(
    tenantId: string,
    customerId: string,
    wishlistId?: string,
  ) {
    if (wishlistId) {
      const wishlist = await this.drizzle.db.query.wishlists.findFirst({
        where: and(
          eq(wishlists.id, wishlistId),
          eq(wishlists.customerId, customerId),
        ),
      });
      if (!wishlist) throw new Error("Wishlist não encontrada");
      return wishlist;
    }
    return this.getDefaultWishlist(tenantId, customerId);
  }

  private async getDefaultWishlist(tenantId: string, customerId: string) {
    const existing = await this.drizzle.db.query.wishlists.findFirst({
      where: and(
        eq(wishlists.tenantId, tenantId),
        eq(wishlists.customerId, customerId),
        eq(wishlists.name, DEFAULT_WISHLIST_NAME),
      ),
    });
    if (existing) return existing;

    const [created] = await this.drizzle.db
      .insert(wishlists)
      .values({
        tenantId,
        customerId,
        name: DEFAULT_WISHLIST_NAME,
        isPublic: false,
      })
      .returning();
    return created;
  }

  private mapItemDetail(
    item: typeof wishlistItems.$inferSelect,
    product: typeof products.$inferSelect | undefined,
  ): WishlistItemDetail {
    const images = isProductImageArray(product?.images)
      ? product.images
      : undefined;
    return {
      id: item.id,
      productId: item.productId,
      productName: product?.name ?? "",
      productImage: images?.[0]?.url ?? null,
      productPrice: Number(product?.price) || 0,
      productSlug: product?.slug ?? "",
      note: item.note,
      sortOrder: item.sortOrder,
      addedAt: item.createdAt,
    };
  }
}
