import { Module } from "@nestjs/common";
import { WishlistController } from "./wishlist.controller";
import { WishlistService } from "./wishlist.service";
import { WishlistItemsService } from "./wishlist-items.service";

@Module({
  controllers: [WishlistController],
  providers: [WishlistService, WishlistItemsService],
  exports: [WishlistService, WishlistItemsService],
})
export class WishlistModule {}
