import { Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { DrizzleService } from "../database/drizzle.service";
import {
  customerEmailVerifications,
  customers,
} from "../database/schema";
import { MailService } from "../mail/mail.service";

const VERIFICATION_TOKEN_BYTES = 32;
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AuthEmailService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly mailService: MailService,
  ) {}

  async createVerification(
    tenantId: string,
    customerId: string,
    email: string,
  ): Promise<void> {
    const token = randomBytes(VERIFICATION_TOKEN_BYTES).toString("hex");
    await this.drizzle.db.insert(customerEmailVerifications).values({
      tenantId,
      customerId,
      token,
      expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
    });
    await this.mailService.sendVerificationEmail(email, token);
  }

  async verify(token: string) {
    const verification =
      await this.drizzle.db.query.customerEmailVerifications.findFirst({
        where: and(
          eq(customerEmailVerifications.token, token),
          gt(customerEmailVerifications.expiresAt, new Date()),
          isNull(customerEmailVerifications.usedAt),
        ),
      });
    if (!verification) throw new NotFoundException("Token inválido ou expirado");

    await this.drizzle.db
      .update(customers)
      .set({ isEmailVerified: true, updatedAt: new Date() })
      .where(eq(customers.id, verification.customerId));
    await this.drizzle.db
      .update(customerEmailVerifications)
      .set({ usedAt: new Date() })
      .where(eq(customerEmailVerifications.id, verification.id));

    return { message: "Email verificado com sucesso" };
  }
}
