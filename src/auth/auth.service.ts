import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { and, eq } from "drizzle-orm";
import { DrizzleService } from "../database/drizzle.service";
import { customers } from "../database/schema";
import { AuthEmailService } from "./auth-email.service";
import { AuthPasswordService } from "./auth-password.service";
import { AuthSessionService, AuthTokens } from "./auth-session.service";
import { CustomerRow, sanitizeCustomer, SanitizedCustomer } from "./auth.helpers";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

const PASSWORD_SALT_ROUNDS = 12;

export interface AuthResult extends AuthTokens {
  customer: SanitizedCustomer;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly sessionService: AuthSessionService,
    private readonly passwordService: AuthPasswordService,
    private readonly emailService: AuthEmailService,
  ) {}

  async register(
    tenantId: string,
    dto: RegisterDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResult> {
    await this.ensureEmailAvailable(tenantId, dto.email);
    const hashed = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);
    const [customer] = await this.drizzle.db
      .insert(customers)
      .values({
        tenantId,
        email: dto.email.toLowerCase(),
        password: hashed,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        cpf: dto.cpf,
      })
      .returning();

    await this.emailService.createVerification(
      tenantId,
      customer.id,
      customer.email,
    );
    const tokens = await this.sessionService.issueTokens(
      customer,
      ipAddress,
      userAgent,
    );
    return { customer: sanitizeCustomer(customer), ...tokens };
  }

  async login(
    tenantId: string,
    dto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResult> {
    const customer = await this.findActiveCustomer(tenantId, dto.email);
    await this.assertPassword(dto.password, customer);
    const tokens = await this.sessionService.issueTokens(
      customer,
      ipAddress,
      userAgent,
    );
    return { customer: sanitizeCustomer(customer), ...tokens };
  }

  refreshToken(refreshToken: string) {
    return this.sessionService.refreshToken(refreshToken);
  }

  logout(refreshToken: string) {
    return this.sessionService.revoke(refreshToken);
  }

  forgotPassword(tenantId: string, email: string) {
    return this.passwordService.forgot(tenantId, email);
  }

  resetPassword(token: string, newPassword: string) {
    return this.passwordService.reset(token, newPassword);
  }

  verifyEmail(token: string) {
    return this.emailService.verify(token);
  }

  private async ensureEmailAvailable(
    tenantId: string,
    email: string,
  ): Promise<void> {
    const existing = await this.drizzle.db.query.customers.findFirst({
      where: and(
        eq(customers.tenantId, tenantId),
        eq(customers.email, email.toLowerCase()),
      ),
    });
    if (existing) throw new ConflictException("Email já cadastrado");
  }

  private async findActiveCustomer(
    tenantId: string,
    email: string,
  ): Promise<CustomerRow> {
    const customer = await this.drizzle.db.query.customers.findFirst({
      where: and(
        eq(customers.tenantId, tenantId),
        eq(customers.email, email.toLowerCase()),
      ),
    });
    if (!customer || !customer.password) {
      throw new UnauthorizedException("Email ou senha inválidos");
    }
    if (!customer.isActive) {
      throw new UnauthorizedException("Conta desativada");
    }
    return customer;
  }

  private async assertPassword(
    plain: string,
    customer: CustomerRow,
  ): Promise<void> {
    if (!customer.password) {
      throw new UnauthorizedException("Email ou senha inválidos");
    }
    const valid = await bcrypt.compare(plain, customer.password);
    if (!valid) throw new UnauthorizedException("Email ou senha inválidos");
  }
}
