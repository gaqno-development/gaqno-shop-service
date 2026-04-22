import { ConfigService } from "@nestjs/config";
import type { AxiosInstance } from "axios";
import { SsoTenantClient } from "./sso-tenant-client";

describe("SsoTenantClient", () => {
  let httpClient: jest.Mocked<AxiosInstance>;
  let configService: jest.Mocked<ConfigService>;
  let client: SsoTenantClient;

  const ssoProjection = {
    id: "tenant-1",
    slug: "acme",
    name: "Acme",
    vertical: "bakery" as const,
  };

  beforeEach(() => {
    httpClient = {
      get: jest.fn(),
    } as unknown as jest.Mocked<AxiosInstance>;
    configService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;
    client = new SsoTenantClient(httpClient, configService);
  });

  it("should return projection when SSO returns 200", async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === "SSO_SERVICE_URL") return "http://sso:4001";
      if (key === "INTERNAL_SYNC_SECRET") return "s3cret";
      return undefined;
    });
    (httpClient.get as jest.Mock).mockResolvedValue({ data: ssoProjection });

    const result = await client.getById("tenant-1");

    expect(httpClient.get).toHaveBeenCalledWith(
      "http://sso:4001/v1/internal/orgs/tenant-1",
      expect.objectContaining({
        headers: { "x-internal-secret": "s3cret" },
        timeout: 3000,
      }),
    );
    expect(result).toEqual(ssoProjection);
  });

  it("should return null on 404", async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === "SSO_SERVICE_URL") return "http://sso:4001";
      if (key === "INTERNAL_SYNC_SECRET") return "s3cret";
      return undefined;
    });
    (httpClient.get as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      response: { status: 404 },
    });

    const result = await client.getById("missing");

    expect(result).toBeNull();
  });

  it("should return null and log when SSO_SERVICE_URL missing", async () => {
    configService.get.mockReturnValue(undefined);

    const result = await client.getById("tenant-1");

    expect(result).toBeNull();
    expect(httpClient.get).not.toHaveBeenCalled();
  });

  it("should return null on network failure (graceful degradation)", async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === "SSO_SERVICE_URL") return "http://sso:4001";
      if (key === "INTERNAL_SYNC_SECRET") return "s3cret";
      return undefined;
    });
    (httpClient.get as jest.Mock).mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await client.getById("tenant-1");

    expect(result).toBeNull();
  });

  it("should trim trailing slash from SSO_SERVICE_URL", async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === "SSO_SERVICE_URL") return "http://sso:4001/";
      if (key === "INTERNAL_SYNC_SECRET") return "s3cret";
      return undefined;
    });
    (httpClient.get as jest.Mock).mockResolvedValue({ data: ssoProjection });

    await client.getById("tenant-1");

    expect(httpClient.get).toHaveBeenCalledWith(
      "http://sso:4001/v1/internal/orgs/tenant-1",
      expect.anything(),
    );
  });
});
