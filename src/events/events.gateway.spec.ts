import { EventsGateway } from "./events.gateway";
import { EventsService } from "./events.service";
import { tenantRoomName } from "./constants";
import type { AuthenticatedSocket } from "./types";

function createSocket(tenantId: string | undefined): AuthenticatedSocket {
  const joinCalls: string[] = [];
  const socket = {
    id: "socket-1",
    data: {
      user: tenantId
        ? { customerId: "c", email: "e", tenantId }
        : undefined,
    },
    join: (room: string) => {
      joinCalls.push(room);
    },
    disconnect: () => undefined,
  } as unknown as AuthenticatedSocket;
  (socket as unknown as { __joinCalls: string[] }).__joinCalls = joinCalls;
  return socket;
}

type GuardLike = ConstructorParameters<typeof EventsGateway>[1];

describe("EventsGateway", () => {
  it("should hand its server over to EventsService on init", () => {
    const eventsService = new EventsService();
    const setServerSpy = jest.spyOn(eventsService, "setServer");
    const gateway = new EventsGateway(eventsService, {
      canActivate: async () => true,
    } as unknown as GuardLike);
    const fakeServer = { to: () => ({ emit: () => true }) };
    gateway.server = fakeServer as unknown as typeof gateway.server;

    gateway.afterInit();

    expect(setServerSpy).toHaveBeenCalledWith(fakeServer);
  });

  it("should join the tenant room on successful connection", async () => {
    const gateway = new EventsGateway(new EventsService(), {
      canActivate: async () => true,
    } as unknown as GuardLike);
    const socket = createSocket("tenant-abc");

    await gateway.handleConnection(socket);

    const joins = (socket as unknown as { __joinCalls: string[] }).__joinCalls;
    expect(joins).toContain(tenantRoomName("tenant-abc"));
  });

  it("should disconnect the socket when guard rejects", async () => {
    const gateway = new EventsGateway(new EventsService(), {
      canActivate: async () => false,
    } as unknown as GuardLike);
    const socket = createSocket(undefined);
    let disconnected = false;
    socket.disconnect = () => {
      disconnected = true;
      return socket;
    };

    await gateway.handleConnection(socket);

    expect(disconnected).toBe(true);
    const joins = (socket as unknown as { __joinCalls: string[] }).__joinCalls;
    expect(joins).toEqual([]);
  });

  it("should disconnect the socket when guard accepted but no user context is present", async () => {
    const gateway = new EventsGateway(new EventsService(), {
      canActivate: async () => true,
    } as unknown as GuardLike);
    const socket = createSocket(undefined);
    let disconnected = false;
    socket.disconnect = () => {
      disconnected = true;
      return socket;
    };

    await gateway.handleConnection(socket);

    expect(disconnected).toBe(true);
  });
});
