import { Module } from "@nestjs/common";
import { ReportController } from "./report.controller";
import { ReportService } from "./report.service";
import { ReportSalesService } from "./report-sales.service";
import { ReportCustomersService } from "./report-customers.service";
import { ReportInventoryService } from "./report-inventory.service";

@Module({
  controllers: [ReportController],
  providers: [
    ReportService,
    ReportSalesService,
    ReportCustomersService,
    ReportInventoryService,
  ],
  exports: [ReportService],
})
export class ReportModule {}
