import { Module } from "@nestjs/common";
import { LoyaltyController } from "./loyalty.controller";
import { LoyaltyAdminController } from "./loyalty-admin.controller";
import { LoyaltyService } from "./loyalty.service";
import { LoyaltyPointsService } from "./loyalty-points.service";
import { LoyaltyTierService } from "./loyalty-tier.service";
import { LoyaltyAdminService } from "./loyalty-admin.service";

@Module({
  controllers: [LoyaltyController, LoyaltyAdminController],
  providers: [
    LoyaltyService,
    LoyaltyPointsService,
    LoyaltyTierService,
    LoyaltyAdminService,
  ],
  exports: [LoyaltyService, LoyaltyPointsService, LoyaltyTierService],
})
export class LoyaltyModule {}
