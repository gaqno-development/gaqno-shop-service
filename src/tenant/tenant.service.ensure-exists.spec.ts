import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { TenantService } from "./tenant.service";
import {
  SsoTenantClient,
  SsoPublicOrgProjection,
} from "../common/sso-tenant-client";

interface LocalTenant {
  readonly id: string;
  readonly slug: string | null;
  readonly name: string;
}

function makeSsoClient(
  projection: SsoPublicOrgProjection | null,
): jest.Mocked<SsoTenantClient> {
  return {
    getById: jest.fn().mockResolvedValue(projection),
  } as unknown as jest.Mocked<SsoTenantClient>;
}

interface DbStubResult {
  readonly db: {
    readonly query: {
      readonly tenants: { findFirst: jest.Mock };
      readonly tenantFeatureFlags: { findFirst: jest.Mock };
    };
    readonly insert: jest.Mock;
    readonly update: jest.Mock;
  };
  readonly tenantsFindFirst: jest.Mock;
  readonly flagsFindFirst: jest.Mock;
  readonly insertValues: jest.Mock;
  readonly insertReturning: jest.Mock;
}

function makeDb(
  localById: LocalTenant | null,
  localBySlug: LocalTenant | null,
  insertedTenant: LocalTenant | null,
): DbStubResult {
  const tenantsFindFirst = jest.fn().mockImplementation(() => {
    const callIndex = tenantsFindFirst.mock.calls.length - 1;
    if (callIndex === 0) return Promise.resolve(localById);
    return Promise.resolve(localBySlug);
  });

  const flagsFindFirst = jest.fn().mockResolvedValue(null);

  const insertReturning = jest
    .fn()
    .mockResolvedValue(insertedTenant ? [insertedTenant] : []);
  const insertValues = jest.fn().mockReturnValue({ returning: insertReturning });
  const insertFn = jest.fn().mockReturnValue({ values: insertValues });

  const updateReturning = jest.fn().mockResolvedValue([]);
  const updateWhere = jest.fn().mockReturnValue({ returning: updateReturning });
  const updateSet = jest.fn().mockReturnValue({ where: updateWhere });
  const updateFn = jest.fn().mockReturnValue({ set: updateSet });

  return {
    db: {
      query: {
        tenants: { findFirst: tenantsFindFirst },
        tenantFeatureFlags: { findFirst: flagsFindFirst },
      },
      insert: insertFn,
      update: updateFn,
    },
    tenantsFindFirst,
    flagsFindFirst,
    insertValues,
    insertReturning,
  };
}

describe("TenantService.ensureTenantExists", () => {
  let service: TenantService;

  async function buildService(
    db: DbStubResult["db"],
    ssoClient: SsoTenantClient,
  ): Promise<void> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        { provide: "DATABASE", useValue: db },
        { provide: SsoTenantClient, useValue: ssoClient },
      ],
    }).compile();
    service = module.get<TenantService>(TenantService);
  }

  it("returns the local tenant when it already exists by id", async () => {
    const local: LocalTenant = {
      id: "t-local-1",
      slug: "acme",
      name: "Acme",
    };
    const { db } = makeDb(local, null, null);
    const sso = makeSsoClient(null);
    await buildService(db, sso);

    const result = await service.ensureTenantExists("t-local-1");

    expect(result?.id).toBe("t-local-1");
    expect(sso.getById).not.toHaveBeenCalled();
  });

  it("syncs the tenant from SSO when missing locally and returns the upserted row", async () => {
    const upserted: LocalTenant = {
      id: "sso-xyz",
      slug: "acme",
      name: "Acme",
    };
    const { db } = makeDb(null, null, upserted);
    const sso = makeSsoClient({
      id: "sso-xyz",
      slug: "acme",
      name: "Acme",
      vertical: "bakery",
    });
    await buildService(db, sso);

    const result = await service.ensureTenantExists("sso-xyz");

    expect(sso.getById).toHaveBeenCalledWith("sso-xyz");
    expect(result?.id).toBe("sso-xyz");
  });

  it("throws NotFoundException when tenant is missing locally and not found in SSO", async () => {
    const { db } = makeDb(null, null, null);
    const sso = makeSsoClient(null);
    await buildService(db, sso);

    await expect(
      service.ensureTenantExists("unknown-id"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("TenantService.getFeatureFlags with tenant sync", () => {
  let service: TenantService;

  async function buildService(db: unknown, ssoClient: SsoTenantClient) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        { provide: "DATABASE", useValue: db },
        { provide: SsoTenantClient, useValue: ssoClient },
      ],
    }).compile();
    service = module.get<TenantService>(TenantService);
  }

  it("ensures the tenant exists before returning flags (synced from SSO when missing)", async () => {
    const upserted: LocalTenant = {
      id: "sso-xyz",
      slug: "acme",
      name: "Acme",
    };
    const stub = makeDb(null, null, upserted);
    const sso = makeSsoClient({
      id: "sso-xyz",
      slug: "acme",
      name: "Acme",
      vertical: null,
    });
    await buildService(stub.db, sso);

    const result = await service.getFeatureFlags("sso-xyz");

    expect(sso.getById).toHaveBeenCalledWith("sso-xyz");
    expect(stub.flagsFindFirst).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
  });

  it("throws NotFoundException when tenant cannot be synced from SSO", async () => {
    const stub = makeDb(null, null, null);
    const sso = makeSsoClient(null);
    await buildService(stub.db, sso);

    await expect(
      service.getFeatureFlags("missing-tenant"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("TenantService identity reconciliation for feature-flags", () => {
  let service: TenantService;

  async function buildService(db: unknown, ssoClient: SsoTenantClient) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        { provide: "DATABASE", useValue: db },
        { provide: SsoTenantClient, useValue: ssoClient },
      ],
    }).compile();
    service = module.get<TenantService>(TenantService);
  }

  it("uses the resolved local tenant id (not the URL tenantId) when ensure returns a pre-seeded row with a different id", async () => {
    const preSeededLocal: LocalTenant = {
      id: "local-seed-uuid",
      slug: "fifia-doces",
      name: "Fifia Doces",
    };
    const tenantsFindFirst = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(preSeededLocal);

    const flagsFindFirst = jest.fn().mockResolvedValue(null);
    const insertReturning = jest
      .fn()
      .mockResolvedValue([{ tenantId: "local-seed-uuid", featureCheckoutPro: true }]);
    const insertValues = jest
      .fn()
      .mockReturnValue({ returning: insertReturning });
    const insertFn = jest.fn().mockReturnValue({ values: insertValues });

    const updateReturning = jest.fn();
    const updateWhere = jest
      .fn()
      .mockReturnValue({ returning: updateReturning });
    const updateSet = jest.fn().mockReturnValue({ where: updateWhere });
    const updateFn = jest.fn().mockReturnValue({ set: updateSet });

    const db = {
      query: {
        tenants: { findFirst: tenantsFindFirst },
        tenantFeatureFlags: { findFirst: flagsFindFirst },
      },
      insert: insertFn,
      update: updateFn,
    };

    const sso = makeSsoClient({
      id: "sso-bbc8b4b7",
      slug: "fifia-doces",
      name: "Fifia Doces",
      vertical: "bakery",
    });
    await buildService(db, sso);

    await service.updateFeatureFlags("sso-bbc8b4b7", {
      featureCheckoutPro: true,
    });

    expect(insertValues).toHaveBeenCalledTimes(1);
    const valuesArg = insertValues.mock.calls[0][0];
    expect(valuesArg.tenantId).toBe("local-seed-uuid");
    expect(valuesArg.featureCheckoutPro).toBe(true);
  });
});

describe("TenantService.updateFeatureFlags with tenant sync", () => {
  let service: TenantService;

  async function buildService(db: unknown, ssoClient: SsoTenantClient) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        { provide: "DATABASE", useValue: db },
        { provide: SsoTenantClient, useValue: ssoClient },
      ],
    }).compile();
    service = module.get<TenantService>(TenantService);
  }

  it("syncs the tenant from SSO before inserting new flags when tenant row is missing", async () => {
    const upserted: LocalTenant = {
      id: "sso-xyz",
      slug: "acme",
      name: "Acme",
    };
    const stub = makeDb(null, null, upserted);
    stub.insertReturning.mockResolvedValueOnce([upserted]);
    stub.insertReturning.mockResolvedValueOnce([
      { tenantId: "sso-xyz", featureRecipes: true },
    ]);
    const sso = makeSsoClient({
      id: "sso-xyz",
      slug: "acme",
      name: "Acme",
      vertical: null,
    });
    await buildService(stub.db, sso);

    const result = await service.updateFeatureFlags("sso-xyz", {
      featureRecipes: true,
    });

    expect(sso.getById).toHaveBeenCalledWith("sso-xyz");
    expect(result).toEqual({ tenantId: "sso-xyz", featureRecipes: true });
  });

  it("throws NotFoundException on update when tenant cannot be synced from SSO", async () => {
    const stub = makeDb(null, null, null);
    const sso = makeSsoClient(null);
    await buildService(stub.db, sso);

    await expect(
      service.updateFeatureFlags("missing", { featureRecipes: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
