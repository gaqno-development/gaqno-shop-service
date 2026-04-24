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
      getTenantIdByDomain: jest.fn(),
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

  it("prioritizes verified JWT tenant over spoofed tenant slug", async () => {
    const tenantFromJwt = { ...tenant, id: "jwt-tenant", slug: "jwt-slug" };
    const spoofedTenant = { ...tenant, id: "spoof-tenant", slug: "spoofed" };
    jwtService.verify.mockReturnValue({ tenantId: "jwt-tenant" } as any);
    tenantService.getById.mockResolvedValue(tenantFromJwt as any);
    tenantService.getBySlug.mockResolvedValue(spoofedTenant as any);
    const next = jest.fn().mockImplementation(() => {
      expect(tenantContextStorage.getStore()?.tenantId).toBe("jwt-tenant");
    });

    await middleware.use(
      makeReq({
        authorization: "Bearer xyz",
        "x-tenant-slug": "spoofed",
      }) as any,
      {} as any,
      next,
    );

    expect(tenantService.getById).toHaveBeenCalledWith("jwt-tenant");
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

  it("on local getById miss, falls back to SSO and upserts by SSO tenant id", async () => {
    jwtService.verify.mockReturnValue({ tenantId: "sso-id-1" } as any);
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

  it("does not fallback by slug when SSO upsert fails", async () => {
    jwtService.verify.mockReturnValue({ tenantId: "sso-id-1" } as any);
    tenantService.getById.mockResolvedValue(undefined as any);
    ssoClient.getById.mockResolvedValue({
      id: "sso-id-1",
      slug: "acme",
      name: "Acme",
      vertical: "bakery",
    });
    tenantService.upsertFromSso.mockResolvedValue(null as any);
    tenantService.getBySlug.mockResolvedValue({ ...tenant, id: "legacy-id" } as any);
    tenantService.resolve.mockResolvedValue(undefined as any);
    const next = jest.fn();

    await middleware.use(
      makeReq({ authorization: "Bearer xyz" }) as any,
      {} as any,
      next,
    );

    expect(tenantService.getBySlug).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
    expect(tenantContextStorage.getStore()).toBeUndefined();
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

  it("falls back to company slug derived from gaqno domain", async () => {
    tenantService.resolve.mockResolvedValue(undefined as any);
    tenantService.getBySlug.mockResolvedValue(tenant as any);
    const next = jest.fn().mockImplementation(() => {
      expect(tenantContextStorage.getStore()?.tenantId).toBe("sso-id-1");
    });

    await middleware.use(
      makeReq({ "x-tenant-domain": "fifiadoces.gaqno.com.br" }) as any,
      {} as any,
      next,
    );

    expect(tenantService.getBySlug).toHaveBeenCalledWith("fifiadoces");
    expect(next).toHaveBeenCalled();
  });

  it("falls back to SSO domain lookup and lazy sync when local domain and slug miss", async () => {
    tenantService.resolve.mockResolvedValue(undefined as any);
    tenantService.getBySlug.mockResolvedValue(undefined as any);
    ssoClient.getTenantIdByDomain.mockResolvedValue("sso-id-1");
    ssoClient.getById.mockResolvedValue({
      id: "sso-id-1",
      slug: "fifiadoces",
      name: "Fifia Doces",
      vertical: "bakery",
    });
    tenantService.upsertFromSso.mockResolvedValue(tenant as any);
    const next = jest.fn().mockImplementation(() => {
      expect(tenantContextStorage.getStore()?.tenantId).toBe("sso-id-1");
    });

    await middleware.use(
      makeReq({ "x-tenant-domain": "fifiadoces.gaqno.com.br" }) as any,
      {} as any,
      next,
    );

    expect(ssoClient.getTenantIdByDomain).toHaveBeenCalledWith(
      "fifiadoces.gaqno.com.br",
    );
    expect(ssoClient.getById).toHaveBeenCalledWith("sso-id-1");
    expect(next).toHaveBeenCalled();
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

  it("does not trust unverified JWT decode fallback", async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error("invalid token");
    });
    jwtService.decode.mockReturnValue({ tenantId: "spoof-tenant" } as any);
    tenantService.getBySlug.mockResolvedValue(undefined as any);
    tenantService.resolve.mockResolvedValue(undefined as any);
    tenantService.getById.mockResolvedValue(undefined as any);
    const next = jest.fn();

    await middleware.use(
      makeReq({ authorization: "Bearer invalid" }) as any,
      {} as any,
      next,
    );

    expect(tenantService.getById).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
