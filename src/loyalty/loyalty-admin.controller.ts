import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { LoyaltyAdminService } from "./loyalty-admin.service";
import {
  AdjustPointsDto,
  CreateTierRuleDto,
  UpdateTierRuleDto,
} from "./dto/loyalty.dto";

@Controller("loyalty/admin")
export class LoyaltyAdminController {
  constructor(private readonly adminService: LoyaltyAdminService) {}

  @Get("points")
  async getAllCustomerPoints(
    @Query("tenantId") tenantId: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    const data = await this.adminService.listCustomerPoints(
      tenantId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
    return { data };
  }

  @Get("tier-rules")
  async getTierRules(@Query("tenantId") tenantId: string) {
    const data = await this.adminService.listTierRules(tenantId);
    return { data };
  }

  @Post("tier-rules")
  async createTierRule(
    @Query("tenantId") tenantId: string,
    @Body() dto: CreateTierRuleDto,
  ) {
    const data = await this.adminService.createTierRule(tenantId, dto);
    return { data };
  }

  @Post("tier-rules/:id")
  async updateTierRule(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("tenantId") tenantId: string,
    @Body() dto: UpdateTierRuleDto,
  ) {
    const data = await this.adminService.updateTierRule(tenantId, id, dto);
    return { data };
  }

  @Post("adjust-points")
  async adjustPoints(
    @Query("tenantId") tenantId: string,
    @Query("customerId", ParseUUIDPipe) customerId: string,
    @Body() dto: AdjustPointsDto,
  ) {
    return this.adminService.adjustPoints(tenantId, customerId, dto);
  }
}
