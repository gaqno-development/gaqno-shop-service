import { OrderReadService } from "./order-read.service";
import { OrderQueryDto } from "./dto/order.dto";

interface FakeQueryApi {
  readonly findMany: jest.Mock;
}

interface FakeShopDatabase {
  readonly query: { readonly orders: FakeQueryApi };
  readonly select: jest.Mock;
}

function createDbStub(
  items: unknown[],
  total: number,
): FakeShopDatabase {
  const from = jest.fn().mockReturnValue({
    where: jest.fn().mockResolvedValue([{ count: total }]),
  });
  return {
    query: { orders: { findMany: jest.fn().mockResolvedValue(items) } },
    select: jest.fn().mockReturnValue({ from }),
  };
}

function makeQuery(overrides: Partial<OrderQueryDto> = {}): OrderQueryDto {
  return Object.assign(new OrderQueryDto(), overrides);
}

describe("OrderReadService.findAll", () => {
  const TENANT = "tenant-1";

  it("should default page to 1 and limit to 20 when not provided", async () => {
    const db = createDbStub([], 0);
    const service = new OrderReadService(db as never);

    const result = await service.findAll(TENANT, makeQuery());

    expect(db.query.orders.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20, offset: 0 }),
    );
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.totalPages).toBe(0);
  });

  it("should convert page to offset = (page - 1) * limit", async () => {
    const db = createDbStub([], 55);
    const service = new OrderReadService(db as never);

    const result = await service.findAll(
      TENANT,
      makeQuery({ page: 3, limit: 10 }),
    );

    expect(db.query.orders.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, offset: 20 }),
    );
    expect(result.totalPages).toBe(6);
  });

  it("should prefer explicit offset over page-derived offset for backwards compat", async () => {
    const db = createDbStub([], 0);
    const service = new OrderReadService(db as never);

    await service.findAll(TENANT, makeQuery({ offset: 40, limit: 10 }));

    expect(db.query.orders.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, offset: 40 }),
    );
  });

  it("should return items under the data key to match PaginatedResponse shape", async () => {
    const fakeItems = [{ id: "o1" }, { id: "o2" }];
    const db = createDbStub(fakeItems, 2);
    const service = new OrderReadService(db as never);

    const result = await service.findAll(TENANT, makeQuery());

    expect(result.data).toEqual(fakeItems);
    expect(result.total).toBe(2);
  });
});
