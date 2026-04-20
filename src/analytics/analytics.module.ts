import { Module } from "@nestjs/common";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsDashboardService } from "./analytics-dashboard.service";
import { AnalyticsProductsService } from "./analytics-products.service";
import { AnalyticsOperationalService } from "./analytics-operational.service";

@Module({
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    AnalyticsDashboardService,
    AnalyticsProductsService,
    AnalyticsOperationalService,
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
