import { Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { DrizzleService } from "../database/drizzle.service";
import {
  customerPasswordResets,
  customers,
} from "../database/schema";
import { MailService } from "../mail/mail.service";
import { AuthSessionService } from "./auth-session.service";

const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const PASSWORD_SALT_ROUNDS = 12;
const GENERIC_MESSAGE =
  "Se o email existir, você receberá um link de recuperação";

@Injectable()
export class AuthPasswordService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly mailService: MailService,
    private readonly sessionService: AuthSessionService,
  ) {}

  async forgot(tenantId: string, email: string) {
    const customer = await this.drizzle.db.query.customers.findFirst({
      where: and(
        eq(customers.tenantId, tenantId),
        eq(customers.email, email.toLowerCase()),
      ),
    });
    if (!customer) return { message: GENERIC_MESSAGE };

    const token = randomBytes(RESET_TOKEN_BYTES).toString("hex");
    await this.drizzle.db.insert(customerPasswordResets).values({
      tenantId,
      customerId: customer.id,
      token,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    });
    await this.mailService.sendPasswordResetEmail(customer.email, token);
    return { message: GENERIC_MESSAGE };
  }

  async reset(token: string, newPassword: string) {
    const record = await this.drizzle.db.query.customerPasswordResets.findFirst({
      where: and(
        eq(customerPasswordResets.token, token),
        gt(customerPasswordResets.expiresAt, new Date()),
        isNull(customerPasswordResets.usedAt),
      ),
    });
    if (!record) throw new NotFoundException("Token inválido ou expirado");

    const hashed = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);
    await this.drizzle.db
      .update(customers)
      .set({ password: hashed, updatedAt: new Date() })
      .where(eq(customers.id, record.customerId));
    await this.drizzle.db
      .update(customerPasswordResets)
      .set({ usedAt: new Date() })
      .where(eq(customerPasswordResets.id, record.id));
    await this.sessionService.revokeAllForCustomer(record.customerId);

    return { message: "Senha alterada com sucesso" };
  }
}
