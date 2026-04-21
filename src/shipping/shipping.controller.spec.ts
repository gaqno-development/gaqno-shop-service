import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { ShippingController } from "./shipping.controller";
import { ShippingMethodService } from "./shipping-method.service";
import { ShippingCalculatorService } from "./shipping-calculator.service";
import { tenantContextStorage, TenantContext } from "../common/tenant-context";

describe("ShippingController", () => {
  let controller: ShippingController;
  let methodService: {
    listMethods: jest.Mock;
    createMethod: jest.Mock;
    findMethod: jest.Mock;
    updateMethod: jest.Mock;
    deleteMethod: jest.Mock;
    getCachedRates: jest.Mock;
    clearCache: jest.Mock;
  };
  let calculator: { calculateShipping: jest.Mock };

  const tenantContext: TenantContext = {
    tenantId: "tenant-123",
    slug: "gaqno-shop",
    domain: "shop.gaqno.com.br",
    name: "Gaqno Shop",
    isDropshipping: false,
    orderPrefix: "GS",
  };

  const runWithTenant = <T>(fn: () => Promise<T>): Promise<T> =>
    tenantContextStorage.run(tenantContext, fn);

  beforeEach(async () => {
    methodService = {
      listMethods: jest.fn(),
      createMethod: jest.fn(),
      findMethod: jest.fn(),
      updateMethod: jest.fn(),
      deleteMethod: jest.fn(),
      getCachedRates: jest.fn(),
      clearCache: jest.fn(),
    };
    calculator = { calculateShipping: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShippingController],
      providers: [
        { provide: ShippingMethodService, useValue: methodService },
        { provide: ShippingCalculatorService, useValue: calculator },
      ],
    }).compile();

    controller = module.get<ShippingController>(ShippingController);
  });

  describe("GET methods", () => {
    it("should throw UnauthorizedException when no tenant is resolved", async () => {
      await expect(controller.getShippingMethods(undefined)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(methodService.listMethods).not.toHaveBeenCalled();
    });

    it("should list methods for the current tenant", async () => {
      const methods = [{ id: "m1" }, { id: "m2" }];
      methodService.listMethods.mockResolvedValue(methods);

      const response = await runWithTenant(() =>
        controller.getShippingMethods(tenantContext.tenantId),
      );

      expect(response).toEqual({ data: methods });
      expect(methodService.listMethods).toHaveBeenCalledWith(tenantContext.tenantId);
    });
  });

  describe("POST methods", () => {
    it("should throw UnauthorizedException without tenant", async () => {
      await expect(
        controller.createShippingMethod(undefined, { name: "SEDEX", carrier: "correios" } as never),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("should delegate to service with tenant id", async () => {
      const dto = { name: "SEDEX", carrier: "correios" } as never;
      methodService.createMethod.mockResolvedValue({ id: "m1" });

      const response = await runWithTenant(() =>
        controller.createShippingMethod(tenantContext.tenantId, dto),
      );

      expect(response).toEqual({ data: { id: "m1" } });
      expect(methodService.createMethod).toHaveBeenCalledWith(
        tenantContext.tenantId,
        dto,
      );
    });
  });

  describe("GET methods/:id", () => {
    it("should throw UnauthorizedException without tenant", async () => {
      await expect(
        controller.getShippingMethod("m1", undefined),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("should return the method for the current tenant", async () => {
      methodService.findMethod.mockResolvedValue({ id: "m1" });
      const response = await runWithTenant(() =>
        controller.getShippingMethod("m1", tenantContext.tenantId),
      );
      expect(response).toEqual({ data: { id: "m1" } });
      expect(methodService.findMethod).toHaveBeenCalledWith(
        tenantContext.tenantId,
        "m1",
      );
    });
  });

  describe("POST calculate", () => {
    it("should throw UnauthorizedException without tenant", async () => {
      await expect(
        controller.calculateShipping(undefined, {
          cepDestino: "01001000",
          productId: "p1",
          quantity: 1,
          subtotal: 100,
        } as never),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("should call calculator with the tenant id from context", async () => {
      calculator.calculateShipping.mockResolvedValue({ options: [] });
      const dto = {
        cepDestino: "01001000",
        productId: "p1",
        quantity: 2,
        subtotal: 250,
      } as never;

      const response = await runWithTenant(() =>
        controller.calculateShipping(tenantContext.tenantId, dto),
      );

      expect(response).toEqual({ data: { options: [] } });
      expect(calculator.calculateShipping).toHaveBeenCalledWith(
        tenantContext.tenantId,
        "01001000",
        [{ productId: "p1", quantity: 2 }],
        250,
      );
    });
  });

  describe("GET cache", () => {
    it("should throw UnauthorizedException without tenant", async () => {
      await expect(
        controller.getCachedRates(undefined, "01001000"),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("should return cached rates for the current tenant", async () => {
      methodService.getCachedRates.mockResolvedValue([{ id: "r1" }]);
      const response = await runWithTenant(() =>
        controller.getCachedRates(tenantContext.tenantId, "01001000"),
      );
      expect(response).toEqual({ data: [{ id: "r1" }] });
      expect(methodService.getCachedRates).toHaveBeenCalledWith(
        tenantContext.tenantId,
        "01001000",
      );
    });
  });
});
