import type { Socket } from "socket.io";

export interface WsUser {
  readonly customerId: string;
  readonly email: string;
  readonly tenantId: string;
}

export interface AuthenticatedSocket extends Socket {
  data: {
    user?: WsUser;
  };
}
