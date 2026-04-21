import { UnauthorizedException } from "@nestjs/common";
import { AuthOauthService, GoogleTokenVerifier } from "./auth-oauth.service";
import { AuthSessionService } from "./auth-session.service";
import type { CustomerRow } from "./auth.helpers";

interface MockDb {
  query: {
    customerOauthAccounts: { findFirst: jest.Mock };
    customers: { findFirst: jest.Mock };
  };
  insert: jest.Mock;
  update: jest.Mock;
}

interface MockDrizzle {
  db: MockDb;
}

function createDrizzleMock(): MockDrizzle {
  const insertReturning = jest.fn();
  const insert = jest.fn().mockReturnValue({
    values: jest.fn().mockReturnValue({
      onConflictDoUpdate: jest.fn().mockReturnValue({ returning: insertReturning }),
      returning: insertReturning,
    }),
  });
  const updateReturning = jest.fn();
  const update = jest.fn().mockReturnValue({
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({ returning: updateReturning }),
    }),
  });
  return {
    db: {
      query: {
        customerOauthAccounts: { findFirst: jest.fn() },
        customers: { findFirst: jest.fn() },
      },
      insert,
      update,
    },
  };
}

describe("AuthOauthService", () => {
  const tenantId = "11111111-1111-1111-1111-111111111111";
  const googleUser = {
    sub: "google-sub-123",
    email: "user@example.com",
    email_verified: true,
    name: "User Example",
    given_name: "User",
    family_name: "Example",
    picture: "https://google/photo.jpg",
  };
  const sessionTokens = {
    accessToken: "jwt.access",
    refreshToken: "refresh",
    expiresIn: 900,
  };

  const verifier: GoogleTokenVerifier = {
    verify: jest.fn(),
  };
  const sessionService = {
    issueTokens: jest.fn(),
  } as unknown as jest.Mocked<AuthSessionService>;

  function buildService(drizzle: MockDrizzle) {
    return new AuthOauthService(
      drizzle as never,
      sessionService,
      verifier,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (sessionService.issueTokens as jest.Mock).mockResolvedValue(sessionTokens);
  });

  it("rejects when Google token verification fails", async () => {
    (verifier.verify as jest.Mock).mockResolvedValue(null);
    const drizzle = createDrizzleMock();
    const service = buildService(drizzle);

    await expect(
      service.signInWithGoogle(tenantId, { accessToken: "bad" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects when Google account has unverified email", async () => {
    (verifier.verify as jest.Mock).mockResolvedValue({
      ...googleUser,
      email_verified: false,
    });
    const drizzle = createDrizzleMock();
    const service = buildService(drizzle);

    await expect(
      service.signInWithGoogle(tenantId, { accessToken: "t" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("creates a new customer when none exists and returns tokens", async () => {
    (verifier.verify as jest.Mock).mockResolvedValue(googleUser);
    const drizzle = createDrizzleMock();
    drizzle.db.query.customers.findFirst.mockResolvedValue(null);

    const newCustomer: CustomerRow = {
      id: "cust-1",
      tenantId,
      email: googleUser.email,
      password: null,
      firstName: "User",
      lastName: "Example",
      phone: null,
      cpf: null,
      birthDate: null,
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      avatarUrl: googleUser.picture,
      isActive: true,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    drizzle.db.insert.mockReturnValueOnce({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([newCustomer]),
      }),
    });
    drizzle.db.insert.mockReturnValueOnce({
      values: jest.fn().mockReturnValue({
        onConflictDoUpdate: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{ id: "oauth-1" }]),
        }),
      }),
    });

    const service = buildService(drizzle);
    const result = await service.signInWithGoogle(tenantId, {
      accessToken: "t",
    });

    expect(result.accessToken).toBe(sessionTokens.accessToken);
    expect(result.customer.email).toBe(googleUser.email);
    expect(sessionService.issueTokens).toHaveBeenCalled();
  });

  it("links Google identity to existing customer with same email", async () => {
    (verifier.verify as jest.Mock).mockResolvedValue(googleUser);
    const existing: CustomerRow = {
      id: "cust-existing",
      tenantId,
      email: googleUser.email,
      password: "hashed",
      firstName: "Existing",
      lastName: null,
      phone: null,
      cpf: null,
      birthDate: null,
      isEmailVerified: false,
      emailVerifiedAt: null,
      avatarUrl: null,
      isActive: true,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const drizzle = createDrizzleMock();
    drizzle.db.query.customers.findFirst.mockResolvedValue(existing);
    drizzle.db.update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([
            { ...existing, isEmailVerified: true, avatarUrl: googleUser.picture },
          ]),
        }),
      }),
    });
    drizzle.db.insert.mockReturnValueOnce({
      values: jest.fn().mockReturnValue({
        onConflictDoUpdate: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{ id: "oauth-1" }]),
        }),
      }),
    });

    const service = buildService(drizzle);
    const result = await service.signInWithGoogle(tenantId, {
      accessToken: "t",
    });

    expect(result.customer.id).toBe("cust-existing");
    expect(drizzle.db.update).toHaveBeenCalled();
  });
});
