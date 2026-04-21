import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DrizzleService } from "../database/drizzle.service";
import {
  customerOauthAccounts,
  customers,
  type NewCustomer,
} from "../database/schema";
import { AuthSessionService } from "./auth-session.service";
import { AuthResult } from "./auth.service";
import { sanitizeCustomer, type CustomerRow } from "./auth.helpers";

export interface GoogleUserProfile {
  readonly sub: string;
  readonly email: string;
  readonly email_verified: boolean;
  readonly name?: string;
  readonly given_name?: string;
  readonly family_name?: string;
  readonly picture?: string;
}

export interface GoogleTokenVerifier {
  verify(accessToken: string): Promise<GoogleUserProfile | null>;
}

export const GOOGLE_TOKEN_VERIFIER = "GOOGLE_TOKEN_VERIFIER";
export const GOOGLE_PROVIDER = "google";

export interface GoogleSignInPayload {
  readonly accessToken: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

@Injectable()
export class AuthOauthService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly sessionService: AuthSessionService,
    @Inject(GOOGLE_TOKEN_VERIFIER)
    private readonly googleVerifier: GoogleTokenVerifier,
  ) {}

  async signInWithGoogle(
    tenantId: string,
    payload: GoogleSignInPayload,
  ): Promise<AuthResult> {
    const profile = await this.googleVerifier.verify(payload.accessToken);
    if (!profile) {
      throw new UnauthorizedException("Token Google inválido");
    }
    if (!profile.email_verified) {
      throw new UnauthorizedException("Email Google não verificado");
    }

    const customer = await this.upsertCustomer(tenantId, profile);
    await this.upsertOauthAccount(tenantId, customer.id, profile, payload);

    const tokens = await this.sessionService.issueTokens(
      customer,
      payload.ipAddress,
      payload.userAgent,
    );
    return { customer: sanitizeCustomer(customer), ...tokens };
  }

  private async upsertCustomer(
    tenantId: string,
    profile: GoogleUserProfile,
  ): Promise<CustomerRow> {
    const existing = await this.drizzle.db.query.customers.findFirst({
      where: and(
        eq(customers.tenantId, tenantId),
        eq(customers.email, profile.email.toLowerCase()),
      ),
    });

    if (existing) {
      return this.linkExistingCustomer(existing, profile);
    }

    const values: NewCustomer = {
      tenantId,
      email: profile.email.toLowerCase(),
      password: null,
      firstName: profile.given_name ?? profile.name ?? null,
      lastName: profile.family_name ?? null,
      avatarUrl: profile.picture ?? null,
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    };
    const [created] = await this.drizzle.db
      .insert(customers)
      .values(values)
      .returning();
    return created as CustomerRow;
  }

  private async linkExistingCustomer(
    existing: CustomerRow,
    profile: GoogleUserProfile,
  ): Promise<CustomerRow> {
    if (!existing.isActive) {
      throw new UnauthorizedException("Conta desativada");
    }
    const [updated] = await this.drizzle.db
      .update(customers)
      .set({
        isEmailVerified: true,
        emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
        avatarUrl: existing.avatarUrl ?? profile.picture ?? null,
        firstName: existing.firstName ?? profile.given_name ?? null,
        lastName: existing.lastName ?? profile.family_name ?? null,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, existing.id))
      .returning();
    return updated as CustomerRow;
  }

  private async upsertOauthAccount(
    tenantId: string,
    customerId: string,
    profile: GoogleUserProfile,
    payload: GoogleSignInPayload,
  ): Promise<void> {
    await this.drizzle.db
      .insert(customerOauthAccounts)
      .values({
        tenantId,
        customerId,
        provider: GOOGLE_PROVIDER,
        providerAccountId: profile.sub,
        accessToken: payload.accessToken,
        scope: "openid email profile",
        tokenType: "Bearer",
      })
      .onConflictDoUpdate({
        target: [
          customerOauthAccounts.provider,
          customerOauthAccounts.providerAccountId,
        ],
        set: {
          customerId,
          accessToken: payload.accessToken,
          updatedAt: new Date(),
        },
      });
  }
}
