import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";
import { tenantContextStorage, TenantContext } from "../common/tenant-context";

describe("AnalyticsController", () => {
  let controller: AnalyticsController;
  let service: {
    getDashboardStats: jest.Mock;
    getRevenueByDay: jest.Mock;
    getTopProducts: jest.Mock;
    getSalesByCategory: jest.Mock;
    getHourlySales: jest.Mock;
    getPaymentMethodStats: jest.Mock;
  };

  const tenantContext: TenantContext = {
    tenantId: "tenant-42",
    slug: "gaqno-shop",
    domain: "shop.gaqno.com.br",
    name: "Gaqno Shop",
    isDropshipping: false,
    orderPrefix: "GS",
  };

  const runWithTenant = <T>(fn: () => Promise<T>): Promise<T> =>
    tenantContextStorage.run(tenantContext, fn);

  beforeEach(async () => {
    service = {
      getDashboardStats: jest.fn(),
      getRevenueByDay: jest.fn(),
      getTopProducts: jest.fn(),
      getSalesByCategory: jest.fn(),
      getHourlySales: jest.fn(),
      getPaymentMethodStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [{ provide: AnalyticsService, useValue: service }],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
  });

  it("should throw UnauthorizedException on dashboard without tenant", async () => {
    await expect(
      controller.getDashboard(undefined, "", ""),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(service.getDashboardStats).not.toHaveBeenCalled();
  });

  it("should delegate dashboard call to service when tenant is resolved", async () => {
    const stats = { revenue: 100 } as never;
    service.getDashboardStats.mockResolvedValue(stats);

    const response = await runWithTenant(() =>
      controller.getDashboard(tenantContext.tenantId, "", ""),
    );

    expect(response).toEqual({ data: stats });
    expect(service.getDashboardStats).toHaveBeenCalledTimes(1);
    const [tenantIdArg] = service.getDashboardStats.mock.calls[0];
    expect(tenantIdArg).toBe(tenantContext.tenantId);
  });

  it("should throw UnauthorizedException on revenue without tenant", async () => {
    await expect(
      controller.getRevenue(undefined, "", ""),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("should throw UnauthorizedException on top-products without tenant", async () => {
    await expect(
      controller.getTopProducts(undefined, "", "", undefined),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("should throw UnauthorizedException on sales-by-category without tenant", async () => {
    await expect(
      controller.getSalesByCategory(undefined, "", ""),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("should throw UnauthorizedException on hourly-sales without tenant", async () => {
    await expect(
      controller.getHourlySales(undefined, ""),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("should throw UnauthorizedException on payment-methods without tenant", async () => {
    await expect(
      controller.getPaymentMethodStats(undefined, "", ""),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
