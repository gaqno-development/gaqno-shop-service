import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { EventsGateway } from "./events.gateway";
import { EventsService } from "./events.service";
import { WsJwtGuard } from "./ws-jwt.guard";

@Module({
  imports: [AuthModule],
  providers: [EventsService, EventsGateway, WsJwtGuard],
  exports: [EventsService],
})
export class EventsModule {}
