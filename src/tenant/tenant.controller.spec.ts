import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { TenantController } from "./tenant.controller";
import { TenantService } from "./tenant.service";
import { tenantContextStorage, TenantContext } from "../common/tenant-context";
import {
  PLATFORM_ADMIN_HTTP_CLIENT,
  PlatformAdminGuard,
} from "../common/guards/platform-admin.guard";

describe("TenantController.currentFeatureFlags", () => {
  let controller: TenantController;
  let tenantService: { getFeatureFlags: jest.Mock };

  const tenantContext: TenantContext = {
    tenantId: "tenant-123",
    slug: "gaqno-shop",
    domain: "shop.gaqno.com.br",
    name: "Gaqno Shop",
    isDropshipping: false,
    orderPrefix: "GS",
  };

  beforeEach(async () => {
    tenantService = { getFeatureFlags: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantController],
      providers: [
        { provide: TenantService, useValue: tenantService },
        {
          provide: PLATFORM_ADMIN_HTTP_CLIENT,
          useValue: { get: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue("http://sso.test") },
        },
        PlatformAdminGuard,
      ],
    })
      .overrideGuard(PlatformAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TenantController>(TenantController);
  });

  it("should return null when no tenant is resolved in the async context", async () => {
    const result = await controller.currentFeatureFlags();

    expect(result).toBeNull();
    expect(tenantService.getFeatureFlags).not.toHaveBeenCalled();
  });

  it("should return the feature flags for the tenant resolved in the async context", async () => {
    const flags = {
      tenantId: tenantContext.tenantId,
      ordersModuleEnabled: true,
      bakeryModuleEnabled: false,
    };
    tenantService.getFeatureFlags.mockResolvedValue(flags);

    const result = await tenantContextStorage.run(tenantContext, () =>
      controller.currentFeatureFlags(),
    );

    expect(result).toEqual(flags);
    expect(tenantService.getFeatureFlags).toHaveBeenCalledWith(
      tenantContext.tenantId,
    );
    expect(tenantService.getFeatureFlags).toHaveBeenCalledTimes(1);
  });

  it("should forward null when the service has no flags for the tenant", async () => {
    tenantService.getFeatureFlags.mockResolvedValue(null);

    const result = await tenantContextStorage.run(tenantContext, () =>
      controller.currentFeatureFlags(),
    );

    expect(result).toBeNull();
    expect(tenantService.getFeatureFlags).toHaveBeenCalledWith(
      tenantContext.tenantId,
    );
  });
});
