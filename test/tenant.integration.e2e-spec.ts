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
import { PlatformAdminGuard } from "../src/common/guards/platform-admin.guard";

const allowAdmin: CanActivate = {
  canActivate: () => true,
};

describe("Tenant HTTP (integration)", () => {
  let app: INestApplication;
  const mockTenantService = {
    resolve: jest.fn(),
    getFeatureFlags: jest.fn(),
    getVerticalPreset: jest.fn(),
    updateProfile: jest.fn(),
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

  it("PATCH /v1/tenants/:id rejects analyticsMeasurementId over max length", () => {
    const tooLong = `G-${"A".repeat(63)}`;
    return request(app.getHttpServer())
      .patch("/v1/tenants/local-tenant-1")
      .set("Authorization", "Bearer test-token")
      .send({ analyticsMeasurementId: tooLong })
      .expect(400);
  });
});
