import { ExecutionContext } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { WsJwtGuard } from "./ws-jwt.guard";
import type { AuthenticatedSocket } from "./types";

interface FakeSocketOptions {
  readonly token?: string;
  readonly header?: string;
  readonly query?: string;
}

function createFakeSocket(options: FakeSocketOptions = {}): AuthenticatedSocket {
  const disconnectCalls: unknown[] = [];
  const socket = {
    handshake: {
      auth: options.token ? { token: options.token } : {},
      headers: options.header ? { authorization: options.header } : {},
      query: options.query ? { token: options.query } : {},
    },
    data: {} as AuthenticatedSocket["data"],
    disconnect: (close?: boolean) => {
      disconnectCalls.push(close);
      return socket;
    },
  } as unknown as AuthenticatedSocket;
  (socket as unknown as { __disconnectCalls: unknown[] }).__disconnectCalls = disconnectCalls;
  return socket;
}

function createContext(socket: AuthenticatedSocket): ExecutionContext {
  return {
    switchToWs: () => ({
      getClient: <T>() => socket as unknown as T,
      getData: () => ({}),
      getPattern: () => "",
    }),
  } as unknown as ExecutionContext;
}

describe("WsJwtGuard", () => {
  const configService = {
    get: (key: string) =>
      key === "JWT_SECRET" ? "test-secret" : undefined,
  } as unknown as ConfigService;

  function createGuard(
    verifyImpl: (token: string, options: unknown) => Promise<unknown>,
  ): WsJwtGuard {
    const jwtService = {
      verifyAsync: verifyImpl,
    } as unknown as JwtService;
    return new WsJwtGuard(jwtService, configService);
  }

  it("should accept a valid token from handshake.auth and attach user", async () => {
    const socket = createFakeSocket({ token: "valid.jwt" });
    const guard = createGuard(async () => ({
      sub: "user-1",
      email: "a@b.com",
      tenantId: "tenant-1",
    }));

    const result = await guard.canActivate(createContext(socket));

    expect(result).toBe(true);
    expect(socket.data.user).toEqual({
      customerId: "user-1",
      email: "a@b.com",
      tenantId: "tenant-1",
    });
  });

  it("should accept a valid token from Authorization header", async () => {
    const socket = createFakeSocket({ header: "Bearer valid.jwt" });
    const guard = createGuard(async () => ({
      sub: "user-2",
      email: "c@d.com",
      tenantId: "tenant-2",
    }));

    const result = await guard.canActivate(createContext(socket));

    expect(result).toBe(true);
    expect(socket.data.user?.tenantId).toBe("tenant-2");
  });

  it("should reject and disconnect when no token provided", async () => {
    const socket = createFakeSocket();
    const guard = createGuard(async () => {
      throw new Error("should not be called");
    });

    const result = await guard.canActivate(createContext(socket));

    expect(result).toBe(false);
    const disconnectCalls = (socket as unknown as { __disconnectCalls: unknown[] })
      .__disconnectCalls;
    expect(disconnectCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("should reject and disconnect when token verification fails", async () => {
    const socket = createFakeSocket({ token: "bad.jwt" });
    const guard = createGuard(async () => {
      throw new Error("invalid signature");
    });

    const result = await guard.canActivate(createContext(socket));

    expect(result).toBe(false);
    const disconnectCalls = (socket as unknown as { __disconnectCalls: unknown[] })
      .__disconnectCalls;
    expect(disconnectCalls.length).toBeGreaterThanOrEqual(1);
    expect(socket.data.user).toBeUndefined();
  });

  it("should reject when payload is missing tenantId", async () => {
    const socket = createFakeSocket({ token: "valid.jwt" });
    const guard = createGuard(async () => ({
      sub: "user-1",
      email: "a@b.com",
    }));

    const result = await guard.canActivate(createContext(socket));

    expect(result).toBe(false);
    expect(socket.data.user).toBeUndefined();
  });
});
