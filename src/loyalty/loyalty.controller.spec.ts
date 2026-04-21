import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { LoyaltyController } from "./loyalty.controller";
import { LoyaltyService } from "./loyalty.service";
import { tenantContextStorage, TenantContext } from "../common/tenant-context";

describe("LoyaltyController", () => {
  let controller: LoyaltyController;
  let service: {
    getPointsSummary: jest.Mock;
    getTransactionHistory: jest.Mock;
    redeemPoints: jest.Mock;
    calculateOrderPoints: jest.Mock;
    getAvailableTiers: jest.Mock;
  };

  const tenantContext: TenantContext = {
    tenantId: "tenant-loyalty",
    slug: "gaqno-shop",
    domain: "shop.gaqno.com.br",
    name: "Gaqno Shop",
    isDropshipping: false,
    orderPrefix: "GS",
  };

  const runWithTenant = <T>(fn: () => Promise<T>): Promise<T> =>
    tenantContextStorage.run(tenantContext, fn);

  const customerId = "11111111-1111-1111-1111-111111111111";

  beforeEach(async () => {
    service = {
      getPointsSummary: jest.fn(),
      getTransactionHistory: jest.fn(),
      redeemPoints: jest.fn(),
      calculateOrderPoints: jest.fn(),
      getAvailableTiers: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoyaltyController],
      providers: [{ provide: LoyaltyService, useValue: service }],
    }).compile();

    controller = module.get<LoyaltyController>(LoyaltyController);
  });

  it("should throw UnauthorizedException on summary without tenant", async () => {
    await expect(
      controller.getPointsSummary(undefined, customerId),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(service.getPointsSummary).not.toHaveBeenCalled();
  });

  it("should delegate summary to service with tenant from context", async () => {
    service.getPointsSummary.mockResolvedValue({ balance: 10 });
    const response = await runWithTenant(() =>
      controller.getPointsSummary(tenantContext.tenantId, customerId),
    );
    expect(response).toEqual({ data: { balance: 10 } });
    expect(service.getPointsSummary).toHaveBeenCalledWith(
      tenantContext.tenantId,
      customerId,
    );
  });

  it("should throw UnauthorizedException on transactions without tenant", async () => {
    await expect(
      controller.getTransactions(undefined, customerId),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("should throw UnauthorizedException on redeem without tenant", async () => {
    await expect(
      controller.redeemPoints(undefined, customerId, { points: 1, orderId: "o1" } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("should throw UnauthorizedException on calculate without tenant", async () => {
    await expect(
      controller.calculateOrderPoints(undefined, customerId, "100"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("should throw UnauthorizedException on tiers without tenant", async () => {
    await expect(controller.getTiers(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
