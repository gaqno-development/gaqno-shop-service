import { Test, TestingModule } from "@nestjs/testing";
import { ShippingMethodService } from "./shipping-method.service";
import { DrizzleService } from "../database/drizzle.service";

type MockFn = jest.Mock;

interface DbMock {
  query: {
    shippingMethods: { findMany: MockFn; findFirst: MockFn };
    shippingRatesCache: { findMany: MockFn };
  };
  insert: MockFn;
  update: MockFn;
  delete: MockFn;
}

function createDbMock(): DbMock {
  return {
    query: {
      shippingMethods: { findMany: jest.fn(), findFirst: jest.fn() },
      shippingRatesCache: { findMany: jest.fn() },
    },
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

function stubInsert(db: DbMock, returning: MockFn): MockFn {
  const values: MockFn = jest.fn(() => ({ returning }));
  db.insert.mockReturnValue({ values });
  return values;
}

function stubUpdate(db: DbMock, returning: MockFn): MockFn {
  const set: MockFn = jest.fn(() => ({
    where: jest.fn(() => ({ returning })),
  }));
  db.update.mockReturnValue({ set });
  return set;
}

describe("ShippingMethodService", () => {
  let service: ShippingMethodService;
  let db: DbMock;

  beforeEach(async () => {
    db = createDbMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShippingMethodService,
        { provide: DrizzleService, useValue: { db } },
      ],
    }).compile();
    service = module.get(ShippingMethodService);
  });

  describe("listMethods", () => {
    it("returns tenant-scoped shipping methods", async () => {
      const methods = [{ id: "m1" }];
      db.query.shippingMethods.findMany.mockResolvedValue(methods);
      const result = await service.listMethods("tenant-1");
      expect(result).toBe(methods);
      expect(db.query.shippingMethods.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe("createMethod", () => {
    it("slugifies the name and returns the inserted row", async () => {
      const returning = jest.fn().mockResolvedValue([
        { id: "m1", slug: "sedex-10" },
      ]);
      stubInsert(db, returning);

      const result = await service.createMethod("tenant-1", {
        name: "Sedex 10",
        carrier: "correios",
        flatRate: 15.9,
        freeShippingThreshold: 200,
      });

      expect(result).toEqual({ id: "m1", slug: "sedex-10" });
    });

    it("defaults optional numeric fields when missing", async () => {
      const returning = jest.fn().mockResolvedValue([{}]);
      const values = stubInsert(db, returning);

      await service.createMethod("tenant-1", {
        name: "PAC",
        carrier: "correios",
      });

      const [insertedPayload] = values.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(insertedPayload.slug).toBe("pac");
      expect(insertedPayload.estimatedDeliveryDaysMin).toBe(1);
      expect(insertedPayload.estimatedDeliveryDaysMax).toBe(7);
      expect(insertedPayload.isActive).toBe(true);
      expect(insertedPayload.flatRate).toBeNull();
      expect(insertedPayload.freeShippingThreshold).toBeNull();
    });
  });

  describe("updateMethod", () => {
    it("serialises numeric fields to strings before updating", async () => {
      const returning = jest.fn().mockResolvedValue([{ id: "m1" }]);
      const set = stubUpdate(db, returning);

      await service.updateMethod("tenant-1", "m1", {
        flatRate: 9.9,
        freeShippingThreshold: 100,
      });

      const [setPayload] = set.mock.calls[0] as [Record<string, unknown>];
      expect(setPayload.flatRate).toBe("9.9");
      expect(setPayload.freeShippingThreshold).toBe("100");
    });

    it("leaves numeric fields untouched when not provided", async () => {
      const returning = jest.fn().mockResolvedValue([{ id: "m1" }]);
      const set = stubUpdate(db, returning);

      await service.updateMethod("tenant-1", "m1", { name: "novo" });
      const [setPayload] = set.mock.calls[0] as [Record<string, unknown>];
      expect(setPayload.flatRate).toBeUndefined();
      expect(setPayload.freeShippingThreshold).toBeUndefined();
      expect(setPayload.name).toBe("novo");
    });
  });

  describe("clearCache", () => {
    it("calls delete scoped to tenantId", async () => {
      const where = jest.fn();
      db.delete.mockReturnValue({ where });
      await service.clearCache("tenant-1");
      expect(db.delete).toHaveBeenCalledTimes(1);
      expect(where).toHaveBeenCalledTimes(1);
    });
  });

  describe("getCachedRates", () => {
    it("strips non-digit characters from cep before querying", async () => {
      db.query.shippingRatesCache.findMany.mockResolvedValue([]);
      await service.getCachedRates("tenant-1", "01310-100");
      expect(db.query.shippingRatesCache.findMany).toHaveBeenCalledTimes(1);
    });
  });
});
