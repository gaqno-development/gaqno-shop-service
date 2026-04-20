import { Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { DrizzleService } from "../database/drizzle.service";
import { wishlists } from "../database/schema";
import { WishlistItemsService } from "./wishlist-items.service";
import { WishlistWithItems } from "./wishlist.types";

const DEFAULT_WISHLIST_NAME = "Favoritos";
const SHARE_TOKEN_BYTES = 32;

type UpdateWishlistData = {
  name?: string;
  isPublic?: boolean;
};

interface UpdateWishlistPayload extends UpdateWishlistData {
  updatedAt: Date;
  shareToken?: string | null;
}

@Injectable()
export class WishlistService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly itemsService: WishlistItemsService,
  ) {}

  async listForCustomer(
    tenantId: string,
    customerId: string,
  ): Promise<WishlistWithItems[]> {
    const list = await this.drizzle.db.query.wishlists.findMany({
      where: and(
        eq(wishlists.tenantId, tenantId),
        eq(wishlists.customerId, customerId),
      ),
      orderBy: [desc(wishlists.updatedAt)],
    });
    return Promise.all(list.map((w) => this.composeWithItems(w)));
  }

  async create(
    tenantId: string,
    customerId: string,
    name: string,
    isPublic = false,
  ) {
    const shareToken = isPublic ? randomBytes(SHARE_TOKEN_BYTES).toString("hex") : null;
    const [created] = await this.drizzle.db
      .insert(wishlists)
      .values({ tenantId, customerId, name, isPublic, shareToken })
      .returning();
    return created;
  }

  async update(
    wishlistId: string,
    customerId: string,
    data: UpdateWishlistData,
  ) {
    const wishlist = await this.findOwned(wishlistId, customerId);
    const payload = this.buildUpdatePayload(wishlist.shareToken, data);
    const [updated] = await this.drizzle.db
      .update(wishlists)
      .set(payload)
      .where(eq(wishlists.id, wishlistId))
      .returning();
    return updated;
  }

  async delete(wishlistId: string, customerId: string) {
    const wishlist = await this.findOwned(wishlistId, customerId);
    if (wishlist.name === DEFAULT_WISHLIST_NAME) {
      throw new Error("Não é possível excluir a lista padrão");
    }
    await this.drizzle.db.delete(wishlists).where(eq(wishlists.id, wishlistId));
    return { success: true };
  }

  async findByShareToken(
    shareToken: string,
  ): Promise<WishlistWithItems | null> {
    const wishlist = await this.drizzle.db.query.wishlists.findFirst({
      where: and(
        eq(wishlists.shareToken, shareToken),
        eq(wishlists.isPublic, true),
      ),
    });
    if (!wishlist) return null;
    return this.composeWithItems(wishlist);
  }

  private async findOwned(wishlistId: string, customerId: string) {
    const wishlist = await this.drizzle.db.query.wishlists.findFirst({
      where: and(
        eq(wishlists.id, wishlistId),
        eq(wishlists.customerId, customerId),
      ),
    });
    if (!wishlist) throw new Error("Lista não encontrada");
    return wishlist;
  }

  private buildUpdatePayload(
    currentShareToken: string | null,
    data: UpdateWishlistData,
  ): UpdateWishlistPayload {
    const payload: UpdateWishlistPayload = { ...data, updatedAt: new Date() };
    if (data.isPublic && !currentShareToken) {
      payload.shareToken = randomBytes(SHARE_TOKEN_BYTES).toString("hex");
    } else if (data.isPublic === false) {
      payload.shareToken = null;
    }
    return payload;
  }

  private async composeWithItems(
    wishlist: typeof wishlists.$inferSelect,
  ): Promise<WishlistWithItems> {
    const items = await this.itemsService.listItems(wishlist.id);
    return { ...wishlist, itemCount: items.length, items };
  }
}
