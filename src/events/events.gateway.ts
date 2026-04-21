import { Logger } from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server } from "socket.io";
import { SHOP_SOCKET_PATH, tenantRoomName } from "./constants";
import { EventsService } from "./events.service";
import type { AuthenticatedSocket } from "./types";
import { WsJwtGuard } from "./ws-jwt.guard";

@WebSocketGateway({
  path: SHOP_SOCKET_PATH,
  cors: { origin: true, credentials: true },
  transports: ["websocket", "polling"],
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly eventsService: EventsService,
    private readonly wsJwtGuard: WsJwtGuard,
  ) {}

  afterInit(): void {
    this.eventsService.setServer(this.server);
    this.logger.log(`Socket.IO gateway initialized on path ${SHOP_SOCKET_PATH}`);
  }

  async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    const allowed = await this.wsJwtGuard.canActivate({
      switchToWs: () => ({
        getClient: <T>() => socket as unknown as T,
        getData: () => ({}),
        getPattern: () => "",
      }),
    } as never);
    if (!allowed) {
      socket.disconnect(true);
      return;
    }
    const tenantId = socket.data.user?.tenantId;
    if (!tenantId) {
      socket.disconnect(true);
      return;
    }
    socket.join(tenantRoomName(tenantId));
    this.logger.debug(
      `Client ${socket.id} joined ${tenantRoomName(tenantId)}`,
    );
  }

  handleDisconnect(socket: AuthenticatedSocket): void {
    this.logger.debug(`Client ${socket.id} disconnected`);
  }
}
