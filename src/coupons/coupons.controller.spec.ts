import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { CouponsController } from "./coupons.controller";
import { CouponsService } from "./coupons.service";
import {
  tenantContextStorage,
  type TenantContext,
} from "../common/tenant-context";

function runWithTenant<T>(tenantId: string, fn: () => T): T {
  const ctx: TenantContext = {
    tenantId,
    slug: "test",
    domain: null,
    name: "Test",
    isDropshipping: false,
    orderPrefix: "ORD",
  };
  return tenantContextStorage.run(ctx, fn);
}

describe("CouponsController", () => {
  let controller: CouponsController;
  let service: jest.Mocked<CouponsService>;

  beforeEach(async () => {
    service = {
      list: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      validate: jest.fn(),
    } as unknown as jest.Mocked<CouponsService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CouponsController],
      providers: [{ provide: CouponsService, useValue: service }],
    }).compile();

    controller = module.get(CouponsController);
  });

  describe("list", () => {
    it("delegates to service with tenantId from context", async () => {
      service.list.mockResolvedValue([{ id: "c1" } as never]);
      const result = await runWithTenant("tenant-1", () => controller.list("tenant-1"));
      expect(service.list).toHaveBeenCalledWith("tenant-1");
      expect(result).toEqual({ data: [{ id: "c1" }] });
    });

    it("throws UnauthorizedException when no tenant context", async () => {
      await expect(controller.list(undefined)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe("validate", () => {
    it("delegates to service.validate and returns result wrapped in data", async () => {
      service.validate.mockResolvedValue({ valid: true, discount: 10 });
      const result = await controller.validate("tenant-1", {
        code: "WELCOME10",
        subtotal: 100,
      });
      expect(service.validate).toHaveBeenCalledWith(
        "tenant-1",
        "WELCOME10",
        100,
      );
      expect(result).toEqual({ data: { valid: true, discount: 10 } });
    });

    it("throws UnauthorizedException without tenant context", async () => {
      await expect(
        controller.validate(undefined, { code: "x", subtotal: 1 }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe("create/update/delete", () => {
    it("create delegates with tenantId", async () => {
      service.create.mockResolvedValue({ id: "c1" } as never);
      const dto = {
        code: "NEW",
        type: "percentage" as const,
        value: 10,
        validFrom: "2026-01-01T00:00:00Z",
        validUntil: "2026-02-01T00:00:00Z",
      };
      const result = await controller.create("tenant-1", dto);
      expect(service.create).toHaveBeenCalledWith("tenant-1", dto);
      expect(result).toEqual({ data: { id: "c1" } });
    });

    it("update delegates with tenantId and id", async () => {
      service.update.mockResolvedValue({ id: "c1" } as never);
      const result = await controller.update("tenant-1", "c1", { code: "x" });
      expect(service.update).toHaveBeenCalledWith("tenant-1", "c1", { code: "x" });
      expect(result).toEqual({ data: { id: "c1" } });
    });

    it("remove delegates with tenantId and id", async () => {
      service.remove.mockResolvedValue();
      await controller.remove("tenant-1", "c1");
      expect(service.remove).toHaveBeenCalledWith("tenant-1", "c1");
    });
  });
});
