import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { WishlistController } from "./wishlist.controller";
import { WishlistService } from "./wishlist.service";
import { WishlistItemsService } from "./wishlist-items.service";
import { tenantContextStorage, TenantContext } from "../common/tenant-context";

describe("WishlistController", () => {
  let controller: WishlistController;
  let wishlistService: {
    listForCustomer: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    findByShareToken: jest.Mock;
  };
  let itemsService: {
    listItems: jest.Mock;
    addItem: jest.Mock;
    removeItem: jest.Mock;
    hasProduct: jest.Mock;
  };

  const tenantContext: TenantContext = {
    tenantId: "tenant-wish",
    slug: "gaqno-shop",
    domain: "shop.gaqno.com.br",
    name: "Gaqno Shop",
    isDropshipping: false,
    orderPrefix: "GS",
  };

  const runWithTenant = <T>(fn: () => Promise<T>): Promise<T> =>
    tenantContextStorage.run(tenantContext, fn);

  const customerId = "22222222-2222-2222-2222-222222222222";

  beforeEach(async () => {
    wishlistService = {
      listForCustomer: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByShareToken: jest.fn(),
    };
    itemsService = {
      listItems: jest.fn(),
      addItem: jest.fn(),
      removeItem: jest.fn(),
      hasProduct: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WishlistController],
      providers: [
        { provide: WishlistService, useValue: wishlistService },
        { provide: WishlistItemsService, useValue: itemsService },
      ],
    }).compile();

    controller = module.get<WishlistController>(WishlistController);
  });

  it("should throw UnauthorizedException on getWishlists without tenant", async () => {
    await expect(
      controller.getWishlists(undefined, customerId),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(wishlistService.listForCustomer).not.toHaveBeenCalled();
  });

  it("should list wishlists using tenant from context", async () => {
    wishlistService.listForCustomer.mockResolvedValue([{ id: "w1" }]);
    const response = await runWithTenant(() =>
      controller.getWishlists(tenantContext.tenantId, customerId),
    );
    expect(response).toEqual({ data: [{ id: "w1" }] });
    expect(wishlistService.listForCustomer).toHaveBeenCalledWith(
      tenantContext.tenantId,
      customerId,
    );
  });

  it("should throw UnauthorizedException on getWishlistItems without tenant", async () => {
    await expect(
      controller.getWishlistItems(undefined, customerId),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("should throw UnauthorizedException on addItem without tenant", async () => {
    await expect(
      controller.addItem(undefined, customerId, {
        productId: "p1",
      } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("should throw UnauthorizedException on createWishlist without tenant", async () => {
    await expect(
      controller.createWishlist(undefined, customerId, {
        name: "n",
        isPublic: false,
      } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("should throw UnauthorizedException on checkProductInWishlist without tenant", async () => {
    await expect(
      controller.checkProductInWishlist(undefined, customerId, "p1"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
