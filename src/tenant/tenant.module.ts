import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { TenantService } from "./tenant.service";
import { TenantController, HealthController } from "./tenant.controller";

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
  providers: [TenantService],
  controllers: [TenantController, HealthController],
  exports: [TenantService, JwtModule],
})
export class TenantModule {}
