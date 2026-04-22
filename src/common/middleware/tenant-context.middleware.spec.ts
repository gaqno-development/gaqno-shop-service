import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { TenantContextMiddleware } from "./tenant-context.middleware";
import { tenantContextStorage } from "../tenant-context";
import type { TenantService } from "../../tenant/tenant.service";
import type { SsoTenantClient } from "../sso-tenant-client";

describe("TenantContextMiddleware", () => {
  let tenantService: jest.Mocked<TenantService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let ssoClient: jest.Mocked<SsoTenantClient>;
  let middleware: TenantContextMiddleware;

  const tenant = {
    id: "sso-id-1",
    slug: "acme",
    name: "Acme",
    domain: null,
    isDropshipping: false,
    orderPrefix: "ACM",
  };

  function makeReq(headers: Record<string, string | undefined>) {
    return { headers };
  }

  beforeEach(() => {
    tenantService = {
      getBySlug: jest.fn(),
      resolve: jest.fn(),
      getById: jest.fn(),
      upsertFromSso: jest.fn(),
    } as unknown as jest.Mocked<TenantService>;
    jwtService = {
      verify: jest.fn(),
      decode: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;
    configService = {
      get: jest.fn().mockReturnValue("secret"),
    } as unknown as jest.Mocked<ConfigService>;
    ssoClient = {
      getById: jest.fn(),
    } as unknown as jest.Mocked<SsoTenantClient>;
    middleware = new TenantContextMiddleware(
      tenantService,
      jwtService,
      configService,
      ssoClient,
    );
  });

  it("populates context from x-tenant-slug header when provided", async () => {
    tenantService.getBySlug.mockResolvedValue(tenant as any);
    const next = jest.fn().mockImplementation(() => {
      expect(tenantContextStorage.getStore()?.tenantId).toBe("sso-id-1");
    });

    await middleware.use(
      makeReq({ "x-tenant-slug": "acme" }) as any,
      {} as any,
      next,
    );

    expect(tenantService.getBySlug).toHaveBeenCalledWith("acme");
    expect(next).toHaveBeenCalled();
  });

  it("populates context from JWT tenantId when local getById succeeds", async () => {
    jwtService.verify.mockReturnValue({ tenantId: "sso-id-1" } as any);
    tenantService.getBySlug.mockResolvedValue(undefined as any);
    tenantService.resolve.mockResolvedValue(undefined as any);
    tenantService.getById.mockResolvedValue(tenant as any);
    const next = jest.fn().mockImplementation(() => {
      expect(tenantContextStorage.getStore()?.tenantId).toBe("sso-id-1");
    });

    await middleware.use(
      makeReq({ authorization: "Bearer xyz" }) as any,
      {} as any,
      next,
    );

    expect(ssoClient.getById).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it("on local getById miss, falls back to SSO, upserts, then resolves locally by slug", async () => {
    jwtService.verify.mockReturnValue({ tenantId: "sso-id-1" } as any);
    tenantService.getBySlug
      .mockResolvedValueOnce(undefined as any)
      .mockResolvedValueOnce(tenant as any);
    tenantService.resolve.mockResolvedValue(undefined as any);
    tenantService.getById.mockResolvedValue(undefined as any);
    ssoClient.getById.mockResolvedValue({
      id: "sso-id-1",
      slug: "acme",
      name: "Acme",
      vertical: "bakery",
    });
    tenantService.upsertFromSso.mockResolvedValue(tenant as any);
    const next = jest.fn().mockImplementation(() => {
      expect(tenantContextStorage.getStore()?.tenantId).toBe("sso-id-1");
    });

    await middleware.use(
      makeReq({ authorization: "Bearer xyz" }) as any,
      {} as any,
      next,
    );

    expect(ssoClient.getById).toHaveBeenCalledWith("sso-id-1");
    expect(tenantService.upsertFromSso).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it("when no tenant can be resolved, calls next with empty context", async () => {
    tenantService.getBySlug.mockResolvedValue(undefined as any);
    tenantService.resolve.mockResolvedValue(undefined as any);
    tenantService.getById.mockResolvedValue(undefined as any);
    ssoClient.getById.mockResolvedValue(null);
    const next = jest.fn();

    await middleware.use(makeReq({}) as any, {} as any, next);

    expect(next).toHaveBeenCalled();
    expect(tenantContextStorage.getStore()).toBeUndefined();
  });

  it("gracefully continues when SSO client throws", async () => {
    jwtService.verify.mockReturnValue({ tenantId: "sso-id-1" } as any);
    tenantService.getBySlug.mockResolvedValue(undefined as any);
    tenantService.resolve.mockResolvedValue(undefined as any);
    tenantService.getById.mockResolvedValue(undefined as any);
    ssoClient.getById.mockRejectedValue(new Error("boom"));
    const next = jest.fn();

    await middleware.use(
      makeReq({ authorization: "Bearer xyz" }) as any,
      {} as any,
      next,
    );

    expect(next).toHaveBeenCalled();
  });
});
