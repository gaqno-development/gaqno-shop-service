import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { WishlistService, WishlistWithItems, WishlistItemDetail } from './wishlist.service';
import { IsString, IsOptional, IsBoolean, IsUUID } from 'class-validator';

class AddItemDto {
  @IsUUID()
  productId: string;

  @IsOptional()
  @IsString()
  wishlistId?: string;
}

class CreateWishlistDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

class UpdateWishlistDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  async getWishlists(
    @Query('tenantId') tenantId: string,
    @Query('customerId', ParseUUIDPipe) customerId: string,
  ): Promise<{ data: WishlistWithItems[] }> {
    const wishlists = await this.wishlistService.getCustomerWishlists(tenantId, customerId);
    return { data: wishlists };
  }

  @Get('items')
  async getWishlistItems(
    @Query('tenantId') tenantId: string,
    @Query('customerId', ParseUUIDPipe) customerId: string,
    @Query('wishlistId') wishlistId?: string,
  ): Promise<{ data: WishlistItemDetail[] }> {
    if (wishlistId) {
      const items = await this.wishlistService.getWishlistItems(wishlistId);
      return { data: items };
    }
    
    const wishlists = await this.wishlistService.getCustomerWishlists(tenantId, customerId);
    const defaultWishlist = wishlists.find(w => w.name === 'Favoritos') || wishlists[0];
    
    if (!defaultWishlist) {
      return { data: [] };
    }
    
    const items = await this.wishlistService.getWishlistItems(defaultWishlist.id);
    return { data: items };
  }

  @Post('items')
  async addItem(
    @Query('tenantId') tenantId: string,
    @Query('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: AddItemDto,
  ) {
    return this.wishlistService.addItem(tenantId, customerId, dto.productId, dto.wishlistId);
  }

  @Delete('items/:itemId')
  async removeItem(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Query('wishlistId', ParseUUIDPipe) wishlistId: string,
    @Query('customerId', ParseUUIDPipe) customerId: string,
  ) {
    return this.wishlistService.removeItem(wishlistId, itemId, customerId);
  }

  @Post('lists')
  async createWishlist(
    @Query('tenantId') tenantId: string,
    @Query('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: CreateWishlistDto,
  ) {
    const wishlist = await this.wishlistService.createWishlist(tenantId, customerId, dto.name, dto.isPublic);
    return { data: wishlist };
  }

  @Post('lists/:wishlistId')
  async updateWishlist(
    @Param('wishlistId', ParseUUIDPipe) wishlistId: string,
    @Query('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: UpdateWishlistDto,
  ) {
    const wishlist = await this.wishlistService.updateWishlist(wishlistId, customerId, dto);
    return { data: wishlist };
  }

  @Delete('lists/:wishlistId')
  async deleteWishlist(
    @Param('wishlistId', ParseUUIDPipe) wishlistId: string,
    @Query('customerId', ParseUUIDPipe) customerId: string,
  ) {
    return this.wishlistService.deleteWishlist(wishlistId, customerId);
  }

  @Get('shared/:shareToken')
  async getSharedWishlist(
    @Param('shareToken') shareToken: string,
  ): Promise<{ data: WishlistWithItems | null }> {
    const wishlist = await this.wishlistService.getSharedWishlist(shareToken);
    return { data: wishlist };
  }

  @Get('check/:productId')
  async checkProductInWishlist(
    @Query('tenantId') tenantId: string,
    @Query('customerId', ParseUUIDPipe) customerId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<{ data: boolean }> {
    const inWishlist = await this.wishlistService.checkProductInWishlist(tenantId, customerId, productId);
    return { data: inWishlist };
  }
}