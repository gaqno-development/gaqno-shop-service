import { Module } from "@nestjs/common";
import { EventsModule } from "../events/events.module";
import { ProductService } from "./product.service";
import { ProductController } from "./product.controller";

@Module({
  imports: [EventsModule],
  providers: [ProductService],
  controllers: [ProductController],
  exports: [ProductService],
})
export class ProductModule {}
