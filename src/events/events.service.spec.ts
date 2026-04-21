import { EventsService } from "./events.service";
import { SHOP_EVENTS, tenantRoomName } from "./constants";

interface EmitCall {
  readonly room: string;
  readonly event: string;
  readonly payload: unknown;
}

function createFakeServer(): {
  readonly server: {
    to: (room: string) => { emit: (event: string, payload: unknown) => boolean };
  };
  readonly calls: EmitCall[];
} {
  const calls: EmitCall[] = [];
  const server = {
    to: (room: string) => ({
      emit: (event: string, payload: unknown) => {
        calls.push({ room, event, payload });
        return true;
      },
    }),
  };
  return { server, calls };
}

describe("EventsService", () => {
  it("should do nothing when server is not yet set", () => {
    const service = new EventsService();
    expect(() =>
      service.emitOrderCreated("tenant-1", { id: "order-1" }),
    ).not.toThrow();
  });

  it("should emit order:created to the tenant room", () => {
    const { server, calls } = createFakeServer();
    const service = new EventsService();
    service.setServer(server as unknown as Parameters<EventsService["setServer"]>[0]);

    service.emitOrderCreated("tenant-1", { id: "order-1", total: 100 });

    expect(calls).toEqual([
      {
        room: tenantRoomName("tenant-1"),
        event: SHOP_EVENTS.ORDER_CREATED,
        payload: { id: "order-1", total: 100 },
      },
    ]);
  });

  it("should emit order:updated to the tenant room", () => {
    const { server, calls } = createFakeServer();
    const service = new EventsService();
    service.setServer(server as unknown as Parameters<EventsService["setServer"]>[0]);

    service.emitOrderUpdated("tenant-2", { id: "order-2" });

    expect(calls[0]).toEqual({
      room: tenantRoomName("tenant-2"),
      event: SHOP_EVENTS.ORDER_UPDATED,
      payload: { id: "order-2" },
    });
  });

  it("should emit order:status-changed to the tenant room", () => {
    const { server, calls } = createFakeServer();
    const service = new EventsService();
    service.setServer(server as unknown as Parameters<EventsService["setServer"]>[0]);

    service.emitOrderStatusChanged("tenant-3", {
      id: "order-3",
      status: "confirmed",
    });

    expect(calls[0]).toEqual({
      room: tenantRoomName("tenant-3"),
      event: SHOP_EVENTS.ORDER_STATUS_CHANGED,
      payload: { id: "order-3", status: "confirmed" },
    });
  });

  it("should emit inventory:low-stock to the tenant room", () => {
    const { server, calls } = createFakeServer();
    const service = new EventsService();
    service.setServer(server as unknown as Parameters<EventsService["setServer"]>[0]);

    service.emitInventoryLowStock("tenant-4", {
      productId: "p1",
      name: "Brigadeiro",
      quantity: 2,
    });

    expect(calls[0]).toEqual({
      room: tenantRoomName("tenant-4"),
      event: SHOP_EVENTS.INVENTORY_LOW_STOCK,
      payload: { productId: "p1", name: "Brigadeiro", quantity: 2 },
    });
  });

  it("should emit dashboard:stats-update to the tenant room with empty payload allowed", () => {
    const { server, calls } = createFakeServer();
    const service = new EventsService();
    service.setServer(server as unknown as Parameters<EventsService["setServer"]>[0]);

    service.emitDashboardStatsUpdate("tenant-5");

    expect(calls[0]).toEqual({
      room: tenantRoomName("tenant-5"),
      event: SHOP_EVENTS.DASHBOARD_STATS_UPDATE,
      payload: { at: expect.any(String) },
    });
  });
});
