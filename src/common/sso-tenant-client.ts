import {
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AxiosInstance } from "axios";
import axios from "axios";

export const SSO_TENANT_HTTP_CLIENT = "SSO_TENANT_HTTP_CLIENT";

export interface SsoPublicOrgProjection {
  readonly id: string;
  readonly slug: string | null;
  readonly name: string;
  readonly vertical: string | null;
}

@Injectable()
export class SsoTenantClient {
  private readonly logger = new Logger(SsoTenantClient.name);

  constructor(
    @Inject(SSO_TENANT_HTTP_CLIENT)
    private readonly httpClient: AxiosInstance,
    private readonly configService: ConfigService,
  ) {}

  async getById(id: string): Promise<SsoPublicOrgProjection | null> {
    const baseUrl = this.configService.get<string>("SSO_SERVICE_URL");
    const secret = this.configService.get<string>("INTERNAL_SYNC_SECRET");
    if (!baseUrl) {
      this.logger.warn("SSO_SERVICE_URL not configured; cannot resolve tenant");
      return null;
    }
    const url = `${baseUrl.replace(/\/+$/, "")}/v1/internal/orgs/${id}`;
    try {
      const response = await this.httpClient.get<SsoPublicOrgProjection>(url, {
        headers: { "x-internal-secret": secret ?? "" },
        timeout: 3000,
      });
      return response.data;
    } catch (error) {
      const axiosError = error as {
        isAxiosError?: boolean;
        response?: { status?: number };
        message?: string;
      };
      if (axiosError.response?.status === 404) {
        return null;
      }
      this.logger.warn(
        `Failed to fetch tenant ${id} from SSO: ${axiosError.message ?? "unknown"}`,
      );
      return null;
    }
  }
}

export const ssoTenantHttpClientProvider = {
  provide: SSO_TENANT_HTTP_CLIENT,
  useFactory: (): AxiosInstance => axios.create(),
};
