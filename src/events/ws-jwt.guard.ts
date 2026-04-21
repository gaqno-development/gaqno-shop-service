import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { AuthenticatedSocket } from "./types";

interface JwtPayload {
  readonly sub?: string;
  readonly email?: string;
  readonly tenantId?: string;
}

function extractBearerToken(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const [scheme, token] = value.split(" ");
  return scheme === "Bearer" && token ? token : undefined;
}

function extractToken(socket: AuthenticatedSocket): string | undefined {
  const auth = socket.handshake.auth as { token?: unknown } | undefined;
  if (auth && typeof auth.token === "string" && auth.token.length > 0) {
    return auth.token;
  }

  const headerToken = extractBearerToken(
    (socket.handshake.headers as { authorization?: string }).authorization,
  );
  if (headerToken) return headerToken;

  const queryToken = (socket.handshake.query as { token?: unknown }).token;
  if (typeof queryToken === "string" && queryToken.length > 0) return queryToken;

  return undefined;
}

function isValidPayload(payload: unknown): payload is Required<JwtPayload> {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as JwtPayload;
  return (
    typeof p.sub === "string" &&
    typeof p.email === "string" &&
    typeof p.tenantId === "string"
  );
}

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const socket = context.switchToWs().getClient<AuthenticatedSocket>();
    const token = extractToken(socket);

    if (!token) {
      socket.disconnect(true);
      return false;
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>("JWT_SECRET"),
      });
      if (!isValidPayload(payload)) {
        socket.disconnect(true);
        return false;
      }
      socket.data.user = {
        customerId: payload.sub,
        email: payload.email,
        tenantId: payload.tenantId,
      };
      return true;
    } catch {
      socket.disconnect(true);
      return false;
    }
  }
}
