import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { TenantService } from "./tenant.service";
import { AI_SERVICE_HTTP_CLIENT } from "./ai-service-client";
import type { SsoPublicOrgProjection } from "../common/sso-tenant-client";

function makeDb(existingBySlug: any | null, insertResult: any[] = []) {
  const findFirstBySlug = jest.fn().mockResolvedValue(existingBySlug);
  const findFirstById = jest.fn();
  const insertChain = {
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue(insertResult),
  };
  const updateChain = {
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([{ ...existingBySlug, name: "patched" }]),
  };
  const db: any = {
    query: {
      tenants: {
        findFirst: jest.fn().mockImplementation((args?: any) => {
          const condition = args?.where;
          if (condition && String(condition).includes("slug")) {
            return Promise.resolve(existingBySlug);
          }
          return Promise.resolve(null);
        }),
      },
    },
    insert: jest.fn().mockReturnValue(insertChain),
    update: jest.fn().mockReturnValue(updateChain),
  };
  db.query.tenants.findFirst = jest
    .fn()
    .mockImplementationOnce(() => Promise.resolve(existingBySlug))
    .mockImplementation(() => Promise.resolve(null));
  return { db, findFirstBySlug, findFirstById, insertChain, updateChain };
}

describe("TenantService.upsertFromSso", () => {
  let service: TenantService;

  async function buildService(db: any) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        { provide: "DATABASE", useValue: db },
        { provide: AI_SERVICE_HTTP_CLIENT, useValue: { post: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();
    service = module.get<TenantService>(TenantService);
  }

  const projection: SsoPublicOrgProjection = {
    id: "sso-id-1",
    slug: "acme",
    name: "Acme",
    vertical: "bakery",
  };

  it("inserts a new tenant using the SSO id as primary key when no local row by slug exists", async () => {
    const { db, insertChain } = makeDb(null, [
      {
        id: "sso-id-1",
        slug: "acme",
        name: "Acme",
        isActive: true,
        isDropshipping: false,
        domain: null,
        orderPrefix: "ORD",
      },
    ]);
    await buildService(db);

    const result = await service.upsertFromSso(projection);

    expect(db.insert).toHaveBeenCalled();
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "sso-id-1",
        slug: "acme",
        name: "Acme",
      }),
    );
    expect(result?.id).toBe("sso-id-1");
  });

  it("returns existing row without modifying id when a row with matching slug exists", async () => {
    const existing = {
      id: "local-legacy-id",
      slug: "acme",
      name: "Acme Legacy",
      isActive: true,
      isDropshipping: false,
      domain: null,
      orderPrefix: "ORD",
    };
    const { db } = makeDb(existing);
    await buildService(db);

    const result = await service.upsertFromSso(projection);

    expect(db.insert).not.toHaveBeenCalled();
    expect(result?.id).toBe("local-legacy-id");
  });

  it("returns null when projection has no slug (cannot dedup)", async () => {
    const { db } = makeDb(null);
    await buildService(db);

    const result = await service.upsertFromSso({
      id: "sso-id-1",
      slug: null,
      name: "Acme",
      vertical: null,
    });

    expect(result).toBeNull();
    expect(db.insert).not.toHaveBeenCalled();
  });
});
