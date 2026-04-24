import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { TenantService } from "./tenant.service";
import { TenantDnsService } from "./tenant-dns.service";
import { TenantController, HealthController } from "./tenant.controller";
import {
  PlatformAdminGuard,
  platformAdminHttpClientProvider,
} from "../common/guards/platform-admin.guard";
import {
  SsoTenantClient,
  ssoTenantHttpClientProvider,
} from "../common/sso-tenant-client";

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET"),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    TenantService,
    TenantDnsService,
    PlatformAdminGuard,
    platformAdminHttpClientProvider,
    SsoTenantClient,
    ssoTenantHttpClientProvider,
  ],
  controllers: [TenantController, HealthController],
  exports: [TenantService, JwtModule, SsoTenantClient],
})
export class TenantModule {}
