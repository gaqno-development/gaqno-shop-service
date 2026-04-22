import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CouponsService } from "./coupons.service";
import { DrizzleService } from "../database/drizzle.service";

type MockFn = jest.Mock;

interface DbMock {
  query: {
    coupons: { findMany: MockFn; findFirst: MockFn };
  };
  insert: MockFn;
  update: MockFn;
  delete: MockFn;
}

function createDbMock(): DbMock {
  return {
    query: {
      coupons: { findMany: jest.fn(), findFirst: jest.fn() },
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

const TENANT = "tenant-lu";
const DAY_MS = 86_400_000;

function dateBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

function dateAfter(now: Date, days: number): Date {
  return new Date(now.getTime() + days * DAY_MS);
}

describe("CouponsService", () => {
  let service: CouponsService;
  let db: DbMock;

  beforeEach(async () => {
    db = createDbMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponsService,
        { provide: DrizzleService, useValue: { db } },
      ],
    }).compile();
    service = module.get(CouponsService);
  });

  describe("list", () => {
    it("returns tenant-scoped coupons", async () => {
      const rows = [{ id: "c1" }];
      db.query.coupons.findMany.mockResolvedValue(rows);
      const result = await service.list(TENANT);
      expect(result).toBe(rows);
      expect(db.query.coupons.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe("create", () => {
    it("uppercases the code, serialises decimals as strings and returns the inserted row", async () => {
      const returning = jest.fn().mockResolvedValue([{ id: "c1", code: "WELCOME10" }]);
      const values = stubInsert(db, returning);

      const result = await service.create(TENANT, {
        code: "welcome10",
        type: "percentage",
        value: 10,
        minOrder: 50,
        maxUses: 100,
        validFrom: "2026-01-01T00:00:00Z",
        validUntil: "2026-12-31T23:59:59Z",
      });

      expect(result).toEqual({ id: "c1", code: "WELCOME10" });
      const [payload] = values.mock.calls[0] as [Record<string, unknown>];
      expect(payload.tenantId).toBe(TENANT);
      expect(payload.code).toBe("WELCOME10");
      expect(payload.value).toBe("10");
      expect(payload.minOrder).toBe("50");
      expect(payload.maxUses).toBe(100);
      expect(payload.isActive).toBe(true);
    });

    it("leaves minOrder null when not provided", async () => {
      const returning = jest.fn().mockResolvedValue([{}]);
      const values = stubInsert(db, returning);

      await service.create(TENANT, {
        code: "FRETEGRATIS",
        type: "fixed",
        value: 15,
        validFrom: "2026-01-01T00:00:00Z",
        validUntil: "2026-02-01T00:00:00Z",
      });

      const [payload] = values.mock.calls[0] as [Record<string, unknown>];
      expect(payload.minOrder).toBeNull();
      expect(payload.maxUses).toBeNull();
    });

    it("rejects when validUntil is before validFrom", async () => {
      await expect(
        service.create(TENANT, {
          code: "BAD",
          type: "fixed",
          value: 5,
          validFrom: "2026-02-01T00:00:00Z",
          validUntil: "2026-01-01T00:00:00Z",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects percentage value greater than 100", async () => {
      await expect(
        service.create(TENANT, {
          code: "OVER",
          type: "percentage",
          value: 150,
          validFrom: "2026-01-01T00:00:00Z",
          validUntil: "2026-02-01T00:00:00Z",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("update", () => {
    it("returns the updated coupon", async () => {
      const returning = jest
        .fn()
        .mockResolvedValue([{ id: "c1", code: "NEW" }]);
      stubUpdate(db, returning);

      const result = await service.update(TENANT, "c1", { code: "new" });
      expect(result).toEqual({ id: "c1", code: "NEW" });
    });

    it("throws NotFoundException when no row was updated", async () => {
      const returning = jest.fn().mockResolvedValue([]);
      stubUpdate(db, returning);
      await expect(service.update(TENANT, "missing", { code: "x" })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe("remove", () => {
    it("deletes scoped to tenant", async () => {
      const where = jest.fn();
      db.delete.mockReturnValue({ where });
      await service.remove(TENANT, "c1");
      expect(db.delete).toHaveBeenCalledTimes(1);
      expect(where).toHaveBeenCalledTimes(1);
    });
  });

  describe("validate", () => {
    const now = new Date("2026-06-15T12:00:00Z");

    beforeAll(() => {
      jest.useFakeTimers().setSystemTime(now);
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it("returns computed discount for a percentage coupon within window", async () => {
      db.query.coupons.findFirst.mockResolvedValue({
        id: "c1",
        code: "P10",
        type: "percentage",
        value: "10",
        minOrder: null,
        maxUses: null,
        usedCount: 0,
        validFrom: dateBefore(now, 1),
        validUntil: dateAfter(now, 10),
        isActive: true,
      });

      const result = await service.validate(TENANT, "p10", 200);
      expect(result.valid).toBe(true);
      expect(result.discount).toBe(20);
      expect(result.coupon?.id).toBe("c1");
    });

    it("returns computed discount for a fixed coupon respecting subtotal cap", async () => {
      db.query.coupons.findFirst.mockResolvedValue({
        id: "c2",
        code: "FIX50",
        type: "fixed",
        value: "50",
        minOrder: null,
        maxUses: null,
        usedCount: 0,
        validFrom: dateBefore(now, 1),
        validUntil: dateAfter(now, 10),
        isActive: true,
      });
      const result = await service.validate(TENANT, "FIX50", 30);
      expect(result.valid).toBe(true);
      expect(result.discount).toBe(30);
    });

    it("invalidates coupon below minOrder", async () => {
      db.query.coupons.findFirst.mockResolvedValue({
        id: "c3",
        code: "BIG",
        type: "percentage",
        value: "20",
        minOrder: "100",
        maxUses: null,
        usedCount: 0,
        validFrom: dateBefore(now, 1),
        validUntil: dateAfter(now, 10),
        isActive: true,
      });
      const result = await service.validate(TENANT, "BIG", 50);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("min_order_not_reached");
    });

    it("invalidates coupon when max uses reached", async () => {
      db.query.coupons.findFirst.mockResolvedValue({
        id: "c4",
        code: "SOLD",
        type: "percentage",
        value: "10",
        minOrder: null,
        maxUses: 5,
        usedCount: 5,
        validFrom: dateBefore(now, 1),
        validUntil: dateAfter(now, 10),
        isActive: true,
      });
      const result = await service.validate(TENANT, "SOLD", 100);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("max_uses_reached");
    });

    it("invalidates coupon outside date window", async () => {
      db.query.coupons.findFirst.mockResolvedValue({
        id: "c5",
        code: "EXP",
        type: "percentage",
        value: "10",
        minOrder: null,
        maxUses: null,
        usedCount: 0,
        validFrom: dateAfter(now, 1),
        validUntil: dateAfter(now, 10),
        isActive: true,
      });
      const result = await service.validate(TENANT, "EXP", 100);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("not_in_window");
    });

    it("invalidates inactive coupon", async () => {
      db.query.coupons.findFirst.mockResolvedValue({
        id: "c6",
        code: "OFF",
        type: "percentage",
        value: "10",
        minOrder: null,
        maxUses: null,
        usedCount: 0,
        validFrom: dateBefore(now, 1),
        validUntil: dateAfter(now, 10),
        isActive: false,
      });
      const result = await service.validate(TENANT, "OFF", 100);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("inactive");
    });

    it("invalidates missing coupon", async () => {
      db.query.coupons.findFirst.mockResolvedValue(undefined);
      const result = await service.validate(TENANT, "MISS", 100);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("not_found");
    });
  });
});
