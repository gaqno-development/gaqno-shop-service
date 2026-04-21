import { Injectable, Logger } from "@nestjs/common";
import type { Server } from "socket.io";
import { SHOP_EVENTS, tenantRoomName } from "./constants";

interface OrderPayload {
  readonly [key: string]: unknown;
}

interface InventoryLowStockPayload {
  readonly productId: string;
  readonly name: string;
  readonly quantity: number;
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private server: Server | undefined;

  setServer(server: Server): void {
    this.server = server;
  }

  emitOrderCreated(tenantId: string, payload: OrderPayload): void {
    this.emit(tenantId, SHOP_EVENTS.ORDER_CREATED, payload);
  }

  emitOrderUpdated(tenantId: string, payload: OrderPayload): void {
    this.emit(tenantId, SHOP_EVENTS.ORDER_UPDATED, payload);
  }

  emitOrderStatusChanged(tenantId: string, payload: OrderPayload): void {
    this.emit(tenantId, SHOP_EVENTS.ORDER_STATUS_CHANGED, payload);
  }

  emitInventoryLowStock(
    tenantId: string,
    payload: InventoryLowStockPayload,
  ): void {
    this.emit(tenantId, SHOP_EVENTS.INVENTORY_LOW_STOCK, payload);
  }

  emitDashboardStatsUpdate(tenantId: string): void {
    this.emit(tenantId, SHOP_EVENTS.DASHBOARD_STATS_UPDATE, {
      at: new Date().toISOString(),
    });
  }

  private emit(tenantId: string, event: string, payload: unknown): void {
    if (!this.server) {
      this.logger.debug(
        `Socket.IO server not ready; skipping emit ${event} to tenant ${tenantId}`,
      );
      return;
    }
    this.server.to(tenantRoomName(tenantId)).emit(event, payload);
  }
}
