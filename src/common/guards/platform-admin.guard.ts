import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AxiosInstance } from "axios";
import axios from "axios";

export const PLATFORM_ADMIN_HTTP_CLIENT = "PLATFORM_ADMIN_HTTP_CLIENT";

const REQUIRED_PERMISSIONS = [
  "platform.all",
  "platform.tenants.provision",
] as const;

interface MyPermissionsResponse {
  readonly permissions?: readonly string[];
}

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  private readonly logger = new Logger(PlatformAdminGuard.name);

  constructor(
    @Inject(PLATFORM_ADMIN_HTTP_CLIENT)
    private readonly httpClient: AxiosInstance,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing Bearer token");
    }

    const baseUrl = this.configService.get<string>("SSO_SERVICE_URL");
    if (!baseUrl) {
      this.logger.error("SSO_SERVICE_URL not configured");
      throw new UnauthorizedException("SSO unavailable");
    }

    const permissions = await this.fetchPermissions(
      baseUrl,
      authorization,
    );

    const isPlatformAdmin = REQUIRED_PERMISSIONS.some((p) =>
      permissions.includes(p),
    );
    if (!isPlatformAdmin) {
      throw new ForbiddenException("Platform admin permission required");
    }

    return true;
  }

  private async fetchPermissions(
    baseUrl: string,
    authorization: string,
  ): Promise<readonly string[]> {
    try {
      const url = `${baseUrl.replace(/\/+$/, "")}/v1/permissions/my-permissions`;
      const response = await this.httpClient.get<MyPermissionsResponse>(url, {
        headers: { Authorization: authorization },
        timeout: 3000,
      });
      return response.data.permissions ?? [];
    } catch (error) {
      this.logger.warn(
        `Failed to fetch permissions from SSO: ${(error as Error).message}`,
      );
      throw new UnauthorizedException("Failed to verify permissions");
    }
  }
}

export const platformAdminHttpClientProvider = {
  provide: PLATFORM_ADMIN_HTTP_CLIENT,
  useFactory: (): AxiosInstance => axios.create(),
};
