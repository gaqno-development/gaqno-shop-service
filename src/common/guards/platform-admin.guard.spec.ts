import { ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PlatformAdminGuard } from "./platform-admin.guard";

type MockAxios = {
  get: jest.Mock;
};

function buildContext(headers: Record<string, string | undefined>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as unknown as ExecutionContext;
}

describe("PlatformAdminGuard", () => {
  let httpClient: MockAxios;
  let configService: ConfigService;
  let guard: PlatformAdminGuard;

  beforeEach(() => {
    httpClient = { get: jest.fn() };
    configService = {
      get: jest.fn((key: string) =>
        key === "SSO_SERVICE_URL" ? "http://sso.test" : undefined,
      ),
    } as unknown as ConfigService;
    guard = new PlatformAdminGuard(httpClient as unknown as import("axios").AxiosInstance, configService);
  });

  it("throws Unauthorized when Authorization header is missing", async () => {
    const ctx = buildContext({});
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("throws Unauthorized when Authorization header is not Bearer", async () => {
    const ctx = buildContext({ authorization: "Basic abc" });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("allows when SSO returns platform.all permission", async () => {
    httpClient.get.mockResolvedValue({
      data: { permissions: ["platform.all"] },
    });
    const ctx = buildContext({ authorization: "Bearer jwt-token" });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(httpClient.get).toHaveBeenCalledWith(
      "http://sso.test/v1/permissions/my-permissions",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer jwt-token" }),
      }),
    );
  });

  it("allows when SSO returns platform.tenants.provision permission", async () => {
    httpClient.get.mockResolvedValue({
      data: { permissions: ["platform.tenants.provision"] },
    });
    const ctx = buildContext({ authorization: "Bearer jwt" });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it("denies with Forbidden when user lacks required permissions", async () => {
    httpClient.get.mockResolvedValue({
      data: { permissions: ["shop.orders.manage"] },
    });
    const ctx = buildContext({ authorization: "Bearer jwt" });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("treats SSO failure as Unauthorized", async () => {
    httpClient.get.mockRejectedValue(new Error("network"));
    const ctx = buildContext({ authorization: "Bearer jwt" });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
