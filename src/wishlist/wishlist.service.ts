import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../database/drizzle.service';
import { wishlists, wishlistItems, products } from '../database/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { randomBytes } from 'crypto';

export interface WishlistWithItems {
  id: string;
  tenantId: string;
  customerId: string;
  name: string;
  isPublic: boolean;
  shareToken: string | null;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
  items: WishlistItemDetail[];
}

export interface WishlistItemDetail {
  id: string;
  productId: string;
  productName: string;
  productImage: string | null;
  productPrice: number;
  productSlug: string;
  note: string | null;
  sortOrder: number;
  addedAt: Date;
}

@Injectable()
export class WishlistService {
  constructor(private readonly drizzle: DrizzleService) {}

  async getOrCreateDefaultWishlist(tenantId: string, customerId: string) {
    const db = this.drizzle.db;
    
    let wishlist = await db.query.wishlists.findFirst({
      where: and(
        eq(wishlists.tenantId, tenantId),
        eq(wishlists.customerId, customerId),
        eq(wishlists.name, 'Favoritos')
      ),
    });

    if (!wishlist) {
      const [created] = await db.insert(wishlists).values({
        tenantId,
        customerId,
        name: 'Favoritos',
        isPublic: false,
      }).returning();
      wishlist = created;
    }

    return wishlist;
  }

  async getCustomerWishlists(tenantId: string, customerId: string): Promise<WishlistWithItems[]> {
    const db = this.drizzle.db;
    
    const wishlistList = await db.query.wishlists.findMany({
      where: and(
        eq(wishlists.tenantId, tenantId),
        eq(wishlists.customerId, customerId)
      ),
      orderBy: [desc(wishlists.updatedAt)],
    });

    const result: WishlistWithItems[] = [];
    
    for (const wishlist of wishlistList) {
      const items = await this.getWishlistItems(wishlist.id);
      result.push({
        ...wishlist,
        itemCount: items.length,
        items,
      });
    }

    return result;
  }

  async getWishlistItems(wishlistId: string): Promise<WishlistItemDetail[]> {
    const db = this.drizzle.db;
    
    const items = await db.query.wishlistItems.findMany({
      where: eq(wishlistItems.wishlistId, wishlistId),
      orderBy: [desc(wishlistItems.createdAt)],
    });

    if (items.length === 0) return [];

    const productIds = items.map(i => i.productId);
    const productData = await db.query.products.findMany({
      where: inArray(products.id, productIds),
    });

    const productMap = new Map(productData.map(p => [p.id, p]));

    return items.map(item => {
      const product = productMap.get(item.productId);
      const images = product?.images as any as Array<{ url: string }> | undefined;
      return {
        id: item.id,
        productId: item.productId,
        productName: product?.name || '',
        productImage: images?.[0]?.url || null,
        productPrice: Number(product?.price) || 0,
        productSlug: product?.slug || '',
        note: item.note,
        sortOrder: item.sortOrder,
        addedAt: item.createdAt,
      };
    });
  }

  async addItem(tenantId: string, customerId: string, productId: string, wishlistId?: string) {
    const db = this.drizzle.db;
    
    const wishlist = wishlistId
      ? await db.query.wishlists.findFirst({
          where: and(
            eq(wishlists.id, wishlistId),
            eq(wishlists.customerId, customerId)
          ),
        })
      : await this.getOrCreateDefaultWishlist(tenantId, customerId);

    if (!wishlist) {
      throw new Error('Wishlist não encontrada');
    }

    const existing = await db.query.wishlistItems.findFirst({
      where: and(
        eq(wishlistItems.wishlistId, wishlist.id),
        eq(wishlistItems.productId, productId)
      ),
    });

    if (existing) {
      return { success: true, message: 'Produto já está na lista' };
    }

    await db.insert(wishlistItems).values({
      wishlistId: wishlist.id,
      productId,
    });

    await db.update(wishlists).set({ updatedAt: new Date() }).where(eq(wishlists.id, wishlist.id));

    return { success: true, message: 'Produto adicionado à lista' };
  }

  async removeItem(wishlistId: string, itemId: string, customerId: string) {
    const db = this.drizzle.db;
    
    const wishlist = await db.query.wishlists.findFirst({
      where: and(
        eq(wishlists.id, wishlistId),
        eq(wishlists.customerId, customerId)
      ),
    });

    if (!wishlist) {
      throw new Error('Lista não encontrada');
    }

    await db.delete(wishlistItems).where(
      and(
        eq(wishlistItems.id, itemId),
        eq(wishlistItems.wishlistId, wishlistId)
      )
    );

    return { success: true, message: 'Produto removido da lista' };
  }

  async createWishlist(tenantId: string, customerId: string, name: string, isPublic = false) {
    const db = this.drizzle.db;
    
    const shareToken = isPublic ? randomBytes(32).toString('hex') : null;

    const [created] = await db.insert(wishlists).values({
      tenantId,
      customerId,
      name,
      isPublic,
      shareToken,
    }).returning();

    return created;
  }

  async updateWishlist(wishlistId: string, customerId: string, data: { name?: string; isPublic?: boolean }) {
    const db = this.drizzle.db;
    
    const wishlist = await db.query.wishlists.findFirst({
      where: and(
        eq(wishlists.id, wishlistId),
        eq(wishlists.customerId, customerId)
      ),
    });

    if (!wishlist) {
      throw new Error('Lista não encontrada');
    }

    const updateData: Record<string, any> = { ...data, updatedAt: new Date() };
    
    if (data.isPublic && !wishlist.shareToken) {
      updateData.shareToken = randomBytes(32).toString('hex');
    } else if (!data.isPublic) {
      updateData.shareToken = null;
    }

    const [updated] = await db.update(wishlists).set(updateData).where(eq(wishlists.id, wishlistId)).returning();

    return updated;
  }

  async deleteWishlist(wishlistId: string, customerId: string) {
    const db = this.drizzle.db;
    
    const wishlist = await db.query.wishlists.findFirst({
      where: and(
        eq(wishlists.id, wishlistId),
        eq(wishlists.customerId, customerId)
      ),
    });

    if (!wishlist) {
      throw new Error('Lista não encontrada');
    }

    if (wishlist.name === 'Favoritos') {
      throw new Error('Não é possível excluir a lista padrão');
    }

    await db.delete(wishlists).where(eq(wishlists.id, wishlistId));

    return { success: true };
  }

  async getSharedWishlist(shareToken: string): Promise<WishlistWithItems | null> {
    const db = this.drizzle.db;
    
    const wishlist = await db.query.wishlists.findFirst({
      where: and(
        eq(wishlists.shareToken, shareToken),
        eq(wishlists.isPublic, true)
      ),
    });

    if (!wishlist) {
      return null;
    }

    const items = await this.getWishlistItems(wishlist.id);
    
    return {
      ...wishlist,
      itemCount: items.length,
      items,
    };
  }

  async checkProductInWishlist(tenantId: string, customerId: string, productId: string): Promise<boolean> {
    const db = this.drizzle.db;
    
    const defaultWishlist = await this.getOrCreateDefaultWishlist(tenantId, customerId);
    
    const item = await db.query.wishlistItems.findFirst({
      where: and(
        eq(wishlistItems.wishlistId, defaultWishlist.id),
        eq(wishlistItems.productId, productId)
      ),
    });

    return !!item;
  }
}