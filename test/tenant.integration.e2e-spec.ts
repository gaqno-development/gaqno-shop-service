import "reflect-metadata";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import {
  INestApplication,
  ValidationPipe,
  CanActivate,
} from "@nestjs/common";
import request from "supertest";
import { TenantModule } from "../src/tenant/tenant.module";
import { TenantService } from "../src/tenant/tenant.service";
import { TenantDnsService } from "../src/tenant/tenant-dns.service";
import { PlatformAdminGuard } from "../src/common/guards/platform-admin.guard";

const allowAdmin: CanActivate = {
  canActivate: () => true,
};

describe("Tenant HTTP (integration)", () => {
  let app: INestApplication;
  const mockTenantService = {
    listActive: jest.fn(),
    listActiveWithSummary: jest.fn(),
    resolve: jest.fn(),
    ensureTenantExists: jest.fn(),
    syncFromSso: jest.fn(),
    getFeatureFlags: jest.fn(),
    getVerticalPreset: jest.fn(),
    updateFeatureFlags: jest.fn(),
    updateProfile: jest.fn(),
  };
  const mockTenantDnsService = {
    checkPublicDns: jest.fn(),
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? "integration-test-jwt";
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        TenantModule,
      ],
    })
      .overrideGuard(PlatformAdminGuard)
      .useValue(allowAdmin)
      .overrideProvider(TenantService)
      .useValue(mockTenantService)
      .overrideProvider(TenantDnsService)
      .useValue(mockTenantDnsService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("v1");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET /v1/health returns ok", () => {
    return request(app.getHttpServer())
      .get("/v1/health")
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({ status: "ok" });
      });
  });

  it("GET /v1/tenants/resolve returns tenant with settings and vertical", async () => {
    const tenantRow = {
      id: "local-tenant-1",
      name: "Loja",
      slug: "loja",
      domain: "loja.example.com",
      settings: {
        analyticsEnabled: true,
        analyticsMeasurementId: "G-ABC123XYZ",
      },
    };
    mockTenantService.resolve.mockResolvedValue(tenantRow);
    mockTenantService.getFeatureFlags.mockResolvedValue({
      tenantId: "local-tenant-1",
      bakeryBuilderEnabled: false,
    });
    mockTenantService.getVerticalPreset.mockResolvedValue({
      vertical: "bakery",
      layoutHint: "default",
      terminologyKey: "bakery",
      defaultFeatures: [],
    });

    const res = await request(app.getHttpServer())
      .get("/v1/tenants/resolve")
      .set("X-Tenant-Domain", "loja.example.com")
      .expect(200);

    expect(mockTenantService.resolve).toHaveBeenCalledWith("loja.example.com");
    expect(res.body.tenant.settings).toEqual(tenantRow.settings);
    expect(res.body.featureFlags).toMatchObject({ tenantId: "local-tenant-1" });
    expect(res.body.vertical).toMatchObject({ vertical: "bakery" });
  });

  it("GET /v1/tenants lists active tenants", async () => {
    mockTenantService.listActive.mockResolvedValue([
      { id: "tenant-1", name: "Loja 1" },
      { id: "tenant-2", name: "Loja 2" },
    ]);

    const res = await request(app.getHttpServer()).get("/v1/tenants").expect(200);

    expect(mockTenantService.listActive).toHaveBeenCalledTimes(1);
    expect(res.body).toHaveLength(2);
  });

  it("GET /v1/tenants/summary returns summary rows", async () => {
    mockTenantService.listActiveWithSummary.mockResolvedValue([
      {
        id: "tenant-1",
        name: "Loja 1",
        ordersCount30d: 12,
        revenue30d: 1500,
      },
    ]);

    const res = await request(app.getHttpServer())
      .get("/v1/tenants/summary")
      .expect(200);

    expect(mockTenantService.listActiveWithSummary).toHaveBeenCalledTimes(1);
    expect(res.body[0]).toMatchObject({ id: "tenant-1", ordersCount30d: 12 });
  });

  it("GET /v1/tenants/resolve returns nulls when tenant missing", async () => {
    mockTenantService.resolve.mockResolvedValue(undefined);

    const res = await request(app.getHttpServer())
      .get("/v1/tenants/resolve")
      .set("X-Tenant-Domain", "unknown.example.com")
      .expect(200);

    expect(res.body.featureFlags).toBeNull();
    expect(res.body.vertical).toBeNull();
    expect(res.body.tenant == null).toBe(true);
  });

  it("PATCH /v1/tenants/:id merges analytics fields (mocked service)", async () => {
    const updated = {
      id: "local-tenant-1",
      name: "Loja",
      settings: {
        analyticsEnabled: true,
        analyticsMeasurementId: "G-NEWMEASURE1",
      },
    };
    mockTenantService.updateProfile.mockResolvedValue(updated);

    const res = await request(app.getHttpServer())
      .patch("/v1/tenants/local-tenant-1")
      .set("Authorization", "Bearer test-token")
      .send({
        analyticsEnabled: true,
        analyticsMeasurementId: "G-NEWMEASURE1",
      })
      .expect(200);

    expect(mockTenantService.updateProfile).toHaveBeenCalledWith(
      "local-tenant-1",
      expect.objectContaining({
        analyticsEnabled: true,
        analyticsMeasurementId: "G-NEWMEASURE1",
      }),
    );
    expect(res.body.settings).toEqual(updated.settings);
  });

  it("PATCH /v1/tenants/:id accepts storefrontCopy payload", async () => {
    const storefrontCopy = {
      v: 1,
      home: {
        hero: {
          eyebrow: "Colecao personalizada",
          primaryCtaLabel: "Ver produtos",
        },
      },
    };
    mockTenantService.updateProfile.mockResolvedValue({
      id: "local-tenant-1",
      name: "Loja",
      settings: { storefrontCopy },
    });

    const res = await request(app.getHttpServer())
      .patch("/v1/tenants/local-tenant-1")
      .set("Authorization", "Bearer test-token")
      .send({ storefrontCopy })
      .expect(200);

    expect(mockTenantService.updateProfile).toHaveBeenCalledWith(
      "local-tenant-1",
      expect.objectContaining({ storefrontCopy }),
    );
    expect(res.body.settings).toEqual({ storefrontCopy });
  });

  it("POST /v1/tenants/switch returns success with tenant when found", async () => {
    mockTenantService.ensureTenantExists.mockResolvedValue({
      id: "tenant-1",
      name: "Loja 1",
    });

    const res = await request(app.getHttpServer())
      .post("/v1/tenants/switch")
      .send({ tenantId: "tenant-1" })
      .expect(200);

    expect(mockTenantService.ensureTenantExists).toHaveBeenCalledWith("tenant-1");
    expect(res.body).toEqual({
      success: true,
      tenant: { id: "tenant-1", name: "Loja 1" },
    });
  });

  it("POST /v1/tenants/switch returns success false when tenantId is missing", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/tenants/switch")
      .send({})
      .expect(200);

    expect(mockTenantService.ensureTenantExists).not.toHaveBeenCalled();
    expect(res.body).toEqual({ success: false, tenant: null });
  });

  it("POST /v1/tenants/sync-from-sso returns synced tenant", async () => {
    mockTenantService.syncFromSso.mockResolvedValue({
      id: "local-tenant-1",
      slug: "loja-sync",
    });

    const res = await request(app.getHttpServer())
      .post("/v1/tenants/sync-from-sso")
      .send({ ssoTenantId: "7f6b8ebf-6fd5-4a04-b14a-cdf909f8456e" })
      .expect(200);

    expect(mockTenantService.syncFromSso).toHaveBeenCalledWith(
      "7f6b8ebf-6fd5-4a04-b14a-cdf909f8456e",
    );
    expect(res.body).toEqual({
      tenant: { id: "local-tenant-1", slug: "loja-sync" },
    });
  });

  it("GET /v1/tenants/:id/feature-flags returns feature flags", async () => {
    mockTenantService.getFeatureFlags.mockResolvedValue({
      tenantId: "tenant-1",
      bakeryBuilderEnabled: true,
    });

    const res = await request(app.getHttpServer())
      .get("/v1/tenants/tenant-1/feature-flags")
      .expect(200);

    expect(mockTenantService.getFeatureFlags).toHaveBeenCalledWith("tenant-1");
    expect(res.body).toMatchObject({
      tenantId: "tenant-1",
      bakeryBuilderEnabled: true,
    });
  });

  it("GET /v1/tenants/:id returns tenant detail with feature flags", async () => {
    mockTenantService.ensureTenantExists.mockResolvedValue({
      id: "tenant-1",
      name: "Loja 1",
    });
    mockTenantService.getFeatureFlags.mockResolvedValue({
      tenantId: "tenant-1",
      bakeryBuilderEnabled: false,
    });

    const res = await request(app.getHttpServer())
      .get("/v1/tenants/tenant-1")
      .expect(200);

    expect(mockTenantService.ensureTenantExists).toHaveBeenCalledWith("tenant-1");
    expect(mockTenantService.getFeatureFlags).toHaveBeenCalledWith("tenant-1");
    expect(res.body).toEqual({
      tenant: { id: "tenant-1", name: "Loja 1" },
      featureFlags: { tenantId: "tenant-1", bakeryBuilderEnabled: false },
    });
  });

  it("PATCH /v1/tenants/:id/feature-flags updates feature flags", async () => {
    mockTenantService.updateFeatureFlags.mockResolvedValue({
      tenantId: "tenant-1",
      featureBakery: true,
    });

    const res = await request(app.getHttpServer())
      .patch("/v1/tenants/tenant-1/feature-flags")
      .send({ featureBakery: true })
      .expect(200);

    expect(mockTenantService.updateFeatureFlags).toHaveBeenCalledWith(
      "tenant-1",
      expect.objectContaining({ featureBakery: true }),
    );
    expect(res.body).toMatchObject({
      tenantId: "tenant-1",
      featureBakery: true,
    });
  });

  it("POST /v1/tenants/:id/check-dns uses body hostname when provided", async () => {
    mockTenantService.ensureTenantExists.mockResolvedValue({
      id: "tenant-1",
      domain: "tenant.example.com",
    });
    mockTenantDnsService.checkPublicDns.mockResolvedValue({
      hostname: "custom.example.com",
      records: [],
    });

    const res = await request(app.getHttpServer())
      .post("/v1/tenants/tenant-1/check-dns")
      .send({ hostname: "custom.example.com" })
      .expect(200);

    expect(mockTenantService.ensureTenantExists).toHaveBeenCalledWith("tenant-1");
    expect(mockTenantDnsService.checkPublicDns).toHaveBeenCalledWith(
      "custom.example.com",
    );
    expect(res.body).toEqual({ hostname: "custom.example.com", records: [] });
  });

  it("POST /v1/tenants/:id/check-dns falls back to tenant domain when hostname is missing", async () => {
    mockTenantService.ensureTenantExists.mockResolvedValue({
      id: "tenant-1",
      domain: "tenant.example.com",
    });
    mockTenantDnsService.checkPublicDns.mockResolvedValue({
      hostname: "tenant.example.com",
      records: [],
    });

    const res = await request(app.getHttpServer())
      .post("/v1/tenants/tenant-1/check-dns")
      .send({})
      .expect(200);

    expect(mockTenantDnsService.checkPublicDns).toHaveBeenCalledWith(
      "tenant.example.com",
    );
    expect(res.body).toEqual({ hostname: "tenant.example.com", records: [] });
  });

  it("PATCH /v1/tenants/:id rejects analyticsMeasurementId over max length", () => {
    const tooLong = `G-${"A".repeat(63)}`;
    return request(app.getHttpServer())
      .patch("/v1/tenants/local-tenant-1")
      .set("Authorization", "Bearer test-token")
      .send({ analyticsMeasurementId: tooLong })
      .expect(400);
  });
});
