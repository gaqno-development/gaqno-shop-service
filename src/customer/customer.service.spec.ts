import { CustomerService } from "./customer.service";
import { CustomerQueryDto } from "./dto/customer.dto";

interface FakeQueryApi {
  readonly findMany: jest.Mock;
}

interface FakeShopDatabase {
  readonly query: { readonly customers: FakeQueryApi };
  readonly select: jest.Mock;
}

function createDbStub(items: unknown[], total: number): FakeShopDatabase {
  const from = jest.fn().mockReturnValue({
    where: jest.fn().mockResolvedValue([{ count: total }]),
  });
  return {
    query: { customers: { findMany: jest.fn().mockResolvedValue(items) } },
    select: jest.fn().mockReturnValue({ from }),
  };
}

function makeQuery(overrides: Partial<CustomerQueryDto> = {}): CustomerQueryDto {
  return Object.assign(new CustomerQueryDto(), overrides);
}

describe("CustomerService.findAll", () => {
  const TENANT = "tenant-1";

  it("should default to page 1 and limit 20 and return PaginatedResponse shape", async () => {
    const db = createDbStub([], 0);
    const service = new CustomerService(db as never);

    const result = await service.findAll(TENANT, makeQuery());

    expect(db.query.customers.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20, offset: 0 }),
    );
    expect(result).toMatchObject({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });
  });

  it("should convert page to offset = (page - 1) * limit", async () => {
    const db = createDbStub([], 45);
    const service = new CustomerService(db as never);

    const result = await service.findAll(
      TENANT,
      makeQuery({ page: 3, limit: 10 }),
    );

    expect(db.query.customers.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, offset: 20 }),
    );
    expect(result.totalPages).toBe(5);
  });

  it("should include search filter in query without erroring", async () => {
    const db = createDbStub([{ id: "c1" }], 1);
    const service = new CustomerService(db as never);

    const result = await service.findAll(
      TENANT,
      makeQuery({ search: "maria", limit: 5 }),
    );

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});
