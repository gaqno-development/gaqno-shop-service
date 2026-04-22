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
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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
    if (!expected) return;
    if (token !== expected) {
      throw new BadRequestException("Invalid internal token");
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
  async list(@Query("tenantId") tenantId: string) {
    if (!tenantId) throw new BadRequestException("tenantId is required");
    return this.service.listForTenant(tenantId);
  }

  @Post("credentials")
  async upsertCredentials(@Body() dto: UpsertCredentialsDto) {
    return this.service.upsertCredentials({
      tenantId: dto.tenantId,
      provider: dto.provider,
      credentials: dto.credentials,
    });
  }

  @Delete(":tenantId/:id")
  async remove(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string
  ) {
    await this.service.remove(tenantId, id);
    return { success: true };
  }
}
