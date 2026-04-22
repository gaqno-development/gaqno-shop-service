import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from "@nestjs/common";
import { CurrentTenant } from "../common/decorators/current-tenant.decorator";
import { requireTenantId } from "../common/tenant-guard";
import { CouponsService } from "./coupons.service";
import {
  CreateCouponDto,
  UpdateCouponDto,
  ValidateCouponDto,
} from "./dto/coupon.dto";

@Controller("coupons")
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  async list(@CurrentTenant("tenantId") tenantId: string | undefined) {
    const data = await this.couponsService.list(requireTenantId(tenantId));
    return { data };
  }

  @Get(":id")
  async findOne(
    @CurrentTenant("tenantId") tenantId: string | undefined,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const data = await this.couponsService.findOne(
      requireTenantId(tenantId),
      id,
    );
    return { data };
  }

  @Post()
  async create(
    @CurrentTenant("tenantId") tenantId: string | undefined,
    @Body() dto: CreateCouponDto,
  ) {
    const data = await this.couponsService.create(
      requireTenantId(tenantId),
      dto,
    );
    return { data };
  }

  @Put(":id")
  async update(
    @CurrentTenant("tenantId") tenantId: string | undefined,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCouponDto,
  ) {
    const data = await this.couponsService.update(
      requireTenantId(tenantId),
      id,
      dto,
    );
    return { data };
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentTenant("tenantId") tenantId: string | undefined,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    await this.couponsService.remove(requireTenantId(tenantId), id);
  }

  @Post("validate")
  @HttpCode(HttpStatus.OK)
  async validate(
    @CurrentTenant("tenantId") tenantId: string | undefined,
    @Body() dto: ValidateCouponDto,
  ) {
    const data = await this.couponsService.validate(
      requireTenantId(tenantId),
      dto.code,
      dto.subtotal,
    );
    return { data };
  }
}
