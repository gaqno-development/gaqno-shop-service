import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { randomBytes } from "crypto";
import { and, eq, gt } from "drizzle-orm";
import { DrizzleService } from "../database/drizzle.service";
import { customerSessions } from "../database/schema";
import { CustomerRow, parseDurationToMs } from "./auth.helpers";

const REFRESH_TOKEN_BYTES = 32;
const ACCESS_TOKEN_TTL_SECONDS = 900;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthSessionService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async issueTokens(
    customer: CustomerRow,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthTokens> {
    const payload = {
      sub: customer.id,
      email: customer.email,
      tenantId: customer.tenantId,
    };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get("JWT_SECRET"),
      expiresIn: this.configService.get("JWT_EXPIRES_IN", "15m"),
    });
    const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
    const refreshDuration = this.configService.get<string>(
      "JWT_REFRESH_EXPIRES_IN",
      "7d",
    );
    const expiresAt = new Date(Date.now() + parseDurationToMs(refreshDuration));

    await this.drizzle.db.insert(customerSessions).values({
      tenantId: customer.tenantId,
      customerId: customer.id,
      token: refreshToken,
      expiresAt,
      ipAddress,
      userAgent,
    });

    return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const session = await this.drizzle.db.query.customerSessions.findFirst({
      where: and(
        eq(customerSessions.token, refreshToken),
        gt(customerSessions.expiresAt, new Date()),
      ),
      with: { customer: true },
    });
    if (!session?.customer) {
      throw new UnauthorizedException("Token inválido ou expirado");
    }

    await this.drizzle.db
      .update(customerSessions)
      .set({ lastUsedAt: new Date() })
      .where(eq(customerSessions.id, session.id));

    const tokens = await this.issueTokens(session.customer as CustomerRow);
    await this.drizzle.db
      .delete(customerSessions)
      .where(eq(customerSessions.id, session.id));
    return tokens;
  }

  async revoke(refreshToken: string) {
    await this.drizzle.db
      .delete(customerSessions)
      .where(eq(customerSessions.token, refreshToken));
    return { success: true };
  }

  async revokeAllForCustomer(customerId: string): Promise<void> {
    await this.drizzle.db
      .delete(customerSessions)
      .where(eq(customerSessions.customerId, customerId));
  }
}
