import { Test, TestingModule } from "@nestjs/testing";
import { TenantService } from "./tenant.service";

interface FlagRow {
  readonly tenantId: string;
  readonly featureRecipes?: boolean;
  readonly featureBakery?: boolean;
  readonly featureShipping?: boolean;
}

function makeDb(existing: FlagRow | null) {
  const findFirst = jest.fn().mockResolvedValue(existing);
  const tenantsFindFirst = jest.fn().mockResolvedValue({
    id: "t-stub",
    slug: "stub",
    name: "Stub",
  });

  const returning = jest.fn();
  const where = jest.fn().mockReturnValue({ returning });
  const setObj = jest.fn().mockReturnValue({ where });
  const updateFn = jest.fn().mockReturnValue({ set: setObj });

  const insertReturning = jest.fn();
  const values = jest.fn().mockReturnValue({ returning: insertReturning });
  const insertFn = jest.fn().mockReturnValue({ values });

  return {
    db: {
      query: {
        tenants: { findFirst: tenantsFindFirst },
        tenantFeatureFlags: { findFirst },
      },
      update: updateFn,
      insert: insertFn,
    },
    spies: { findFirst, updateFn, setObj, values, insertFn, returning, insertReturning },
  };
}

describe("TenantService.updateFeatureFlags", () => {
  let service: TenantService;

  async function buildService(dbValue: unknown) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TenantService, { provide: "DATABASE", useValue: dbValue }],
    }).compile();
    service = module.get<TenantService>(TenantService);
  }

  it("updates existing row when flags exist for tenant", async () => {
    const existing: FlagRow = {
      tenantId: "t1",
      featureRecipes: false,
      featureBakery: false,
    };
    const { db, spies } = makeDb(existing);
    const updatedRow = { ...existing, featureRecipes: true };
    spies.returning.mockResolvedValue([updatedRow]);

    await buildService(db);

    const result = await service.updateFeatureFlags("t1", {
      featureRecipes: true,
    });

    expect(spies.insertFn).not.toHaveBeenCalled();
    expect(spies.updateFn).toHaveBeenCalledTimes(1);
    const setArg = spies.setObj.mock.calls[0][0];
    expect(setArg.featureRecipes).toBe(true);
    expect(setArg.updatedAt).toBeInstanceOf(Date);
    expect(result).toEqual(updatedRow);
  });

  it("inserts new row when no flags exist yet for tenant", async () => {
    const { db, spies } = makeDb(null);
    const createdRow = { tenantId: "t2", featureRecipes: true };
    spies.insertReturning.mockResolvedValue([createdRow]);

    await buildService(db);

    const result = await service.updateFeatureFlags("t2", {
      featureRecipes: true,
    });

    expect(spies.updateFn).not.toHaveBeenCalled();
    expect(spies.insertFn).toHaveBeenCalledTimes(1);
    const valuesArg = spies.values.mock.calls[0][0];
    expect(valuesArg.tenantId).toBe("t2");
    expect(valuesArg.featureRecipes).toBe(true);
    expect(result).toEqual(createdRow);
  });

  it("ignores unknown keys in the patch", async () => {
    const existing: FlagRow = { tenantId: "t1" };
    const { db, spies } = makeDb(existing);
    spies.returning.mockResolvedValue([existing]);

    await buildService(db);

    await service.updateFeatureFlags("t1", {
      featureRecipes: true,
      notAFlag: true,
    } as unknown as Record<string, boolean>);

    const setArg = spies.setObj.mock.calls[0][0];
    expect(setArg).not.toHaveProperty("notAFlag");
    expect(setArg.featureRecipes).toBe(true);
  });

  it("does not include undefined flag values in the patch", async () => {
    const existing: FlagRow = { tenantId: "t1" };
    const { db, spies } = makeDb(existing);
    spies.returning.mockResolvedValue([existing]);

    await buildService(db);

    await service.updateFeatureFlags("t1", {
      featureRecipes: true,
      featureBakery: undefined,
    });

    const setArg = spies.setObj.mock.calls[0][0];
    expect(setArg).not.toHaveProperty("featureBakery");
    expect(setArg.featureRecipes).toBe(true);
  });
});
