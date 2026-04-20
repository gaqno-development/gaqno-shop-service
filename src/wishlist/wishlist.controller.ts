import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { WishlistService } from "./wishlist.service";
import { WishlistItemsService } from "./wishlist-items.service";
import {
  AddWishlistItemDto,
  CreateWishlistDto,
  UpdateWishlistDto,
} from "./dto/wishlist.dto";
import {
  WishlistItemDetail,
  WishlistWithItems,
} from "./wishlist.types";

const DEFAULT_WISHLIST_NAME = "Favoritos";

@Controller("wishlist")
export class WishlistController {
  constructor(
    private readonly wishlistService: WishlistService,
    private readonly itemsService: WishlistItemsService,
  ) {}

  @Get()
  async getWishlists(
    @Query("tenantId") tenantId: string,
    @Query("customerId", ParseUUIDPipe) customerId: string,
  ): Promise<{ data: WishlistWithItems[] }> {
    const data = await this.wishlistService.listForCustomer(tenantId, customerId);
    return { data };
  }

  @Get("items")
  async getWishlistItems(
    @Query("tenantId") tenantId: string,
    @Query("customerId", ParseUUIDPipe) customerId: string,
    @Query("wishlistId") wishlistId?: string,
  ): Promise<{ data: WishlistItemDetail[] }> {
    if (wishlistId) {
      const items = await this.itemsService.listItems(wishlistId);
      return { data: items };
    }
    const all = await this.wishlistService.listForCustomer(tenantId, customerId);
    const defaultList = all.find((w) => w.name === DEFAULT_WISHLIST_NAME) ?? all[0];
    if (!defaultList) return { data: [] };
    const items = await this.itemsService.listItems(defaultList.id);
    return { data: items };
  }

  @Post("items")
  async addItem(
    @Query("tenantId") tenantId: string,
    @Query("customerId", ParseUUIDPipe) customerId: string,
    @Body() dto: AddWishlistItemDto,
  ) {
    return this.itemsService.addItem(
      tenantId,
      customerId,
      dto.productId,
      dto.wishlistId,
    );
  }

  @Delete("items/:itemId")
  async removeItem(
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @Query("wishlistId", ParseUUIDPipe) wishlistId: string,
    @Query("customerId", ParseUUIDPipe) customerId: string,
  ) {
    return this.itemsService.removeItem(wishlistId, itemId, customerId);
  }

  @Post("lists")
  async createWishlist(
    @Query("tenantId") tenantId: string,
    @Query("customerId", ParseUUIDPipe) customerId: string,
    @Body() dto: CreateWishlistDto,
  ) {
    const data = await this.wishlistService.create(
      tenantId,
      customerId,
      dto.name,
      dto.isPublic,
    );
    return { data };
  }

  @Post("lists/:wishlistId")
  async updateWishlist(
    @Param("wishlistId", ParseUUIDPipe) wishlistId: string,
    @Query("customerId", ParseUUIDPipe) customerId: string,
    @Body() dto: UpdateWishlistDto,
  ) {
    const data = await this.wishlistService.update(wishlistId, customerId, dto);
    return { data };
  }

  @Delete("lists/:wishlistId")
  async deleteWishlist(
    @Param("wishlistId", ParseUUIDPipe) wishlistId: string,
    @Query("customerId", ParseUUIDPipe) customerId: string,
  ) {
    return this.wishlistService.delete(wishlistId, customerId);
  }

  @Get("shared/:shareToken")
  async getSharedWishlist(
    @Param("shareToken") shareToken: string,
  ): Promise<{ data: WishlistWithItems | null }> {
    const data = await this.wishlistService.findByShareToken(shareToken);
    return { data };
  }

  @Get("check/:productId")
  async checkProductInWishlist(
    @Query("tenantId") tenantId: string,
    @Query("customerId", ParseUUIDPipe) customerId: string,
    @Param("productId", ParseUUIDPipe) productId: string,
  ): Promise<{ data: boolean }> {
    const data = await this.itemsService.hasProduct(tenantId, customerId, productId);
    return { data };
  }
}
