import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes, timingSafeEqual } from "crypto";
import { PaymentGatewaysService } from "./payment-gateways.service";
import {
  BootstrapPaymentGatewayDto,
  UpsertCredentialsDto,
} from "./dto/bootstrap-gateway.dto";

@Controller("payment-gateways")
export class PaymentGatewaysController {
  constructor(
    private readonly service: PaymentGatewaysService,
    private readonly config: ConfigService
  ) {}

  private assertInternal(token: string | undefined) {
    const expected = this.config.get<string>("SHOP_INTERNAL_TOKEN");
    if (!expected) {
      throw new UnauthorizedException("Internal token is not configured");
    }
    if (!token || token.length !== expected.length) {
      throw new UnauthorizedException("Invalid internal token");
    }
    if (!timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
      throw new UnauthorizedException("Invalid internal token");
    }
  }

  @Post("bootstrap")
  async bootstrap(
    @Headers("x-internal-token") token: string | undefined,
    @Body() dto: BootstrapPaymentGatewayDto
  ) {
    this.assertInternal(token);
    return this.service.bootstrap({
      tenantId: dto.tenantId,
      provider: dto.provider,
    });
  }

  @Get()
  async list(
    @Headers("x-internal-token") token: string | undefined,
    @Query("tenantId") tenantId: string
  ) {
    this.assertInternal(token);
    if (!tenantId) throw new BadRequestException("tenantId is required");
    return this.service.listForTenant(tenantId);
  }

  @Post("credentials")
  async upsertCredentials(
    @Headers("x-internal-token") token: string | undefined,
    @Body() dto: UpsertCredentialsDto
  ) {
    this.assertInternal(token);
    return this.service.upsertCredentials({
      tenantId: dto.tenantId,
      provider: dto.provider,
      credentials: dto.credentials,
    });
  }

  @Delete(":tenantId/:id")
  async remove(
    @Headers("x-internal-token") token: string | undefined,
    @Param("tenantId") tenantId: string,
    @Param("id") id: string
  ) {
    this.assertInternal(token);
    await this.service.remove(tenantId, id);
    return { success: true };
  }
}
