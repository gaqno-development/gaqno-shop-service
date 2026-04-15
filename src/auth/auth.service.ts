import { Injectable, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { DrizzleService } from '../database/drizzle.service';
import { customers, customerSessions, customerEmailVerifications, customerPasswordResets } from '../database/schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async register(tenantId: string, dto: RegisterDto, ipAddress?: string, userAgent?: string) {
    const db = this.drizzle.db;

    // Check if email already exists
    const existingCustomer = await db.query.customers.findFirst({
      where: and(
        eq(customers.tenantId, tenantId),
        eq(customers.email, dto.email.toLowerCase())
      ),
    });

    if (existingCustomer) {
      throw new ConflictException('Email já cadastrado');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 12);

    // Create customer
    const [customer] = await db.insert(customers).values({
      tenantId,
      email: dto.email.toLowerCase(),
      password: hashedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      cpf: dto.cpf,
    }).returning();

    // Generate email verification token
    const verificationToken = randomBytes(32).toString('hex');
    await db.insert(customerEmailVerifications).values({
      tenantId,
      customerId: customer.id,
      token: verificationToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    // Send verification email
    await this.mailService.sendVerificationEmail(customer.email, verificationToken);

    // Generate tokens
    const tokens = await this.generateTokens(customer, ipAddress, userAgent);

    return {
      customer: this.sanitizeCustomer(customer),
      ...tokens,
    };
  }

  async login(tenantId: string, dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const db = this.drizzle.db;

    // Find customer
    const customer = await db.query.customers.findFirst({
      where: and(
        eq(customers.tenantId, tenantId),
        eq(customers.email, dto.email.toLowerCase())
      ),
    });

    if (!customer || !customer.password) {
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, customer.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    // Check if customer is active
    if (!customer.isActive) {
      throw new UnauthorizedException('Conta desativada');
    }

    // Generate tokens
    const tokens = await this.generateTokens(customer, ipAddress, userAgent);

    return {
      customer: this.sanitizeCustomer(customer),
      ...tokens,
    };
  }

  async refreshToken(refreshToken: string) {
    const db = this.drizzle.db;

    // Find session
    const session = await db.query.customerSessions.findFirst({
      where: and(
        eq(customerSessions.token, refreshToken),
        gt(customerSessions.expiresAt, new Date()),
      ),
      with: {
        customer: true,
      },
    });

    if (!session) {
      throw new UnauthorizedException('Token inválido ou expirado');
    }

    // Update last used
    await db.update(customerSessions)
      .set({ lastUsedAt: new Date() })
      .where(eq(customerSessions.id, session.id));

    // Generate new tokens
    const tokens = await this.generateTokens(session.customer);

    // Delete old session
    await db.delete(customerSessions).where(eq(customerSessions.id, session.id));

    return tokens;
  }

  async logout(refreshToken: string) {
    const db = this.drizzle.db;

    await db.delete(customerSessions)
      .where(eq(customerSessions.token, refreshToken));

    return { success: true };
  }

  async forgotPassword(tenantId: string, email: string) {
    const db = this.drizzle.db;

    const customer = await db.query.customers.findFirst({
      where: and(
        eq(customers.tenantId, tenantId),
        eq(customers.email, email.toLowerCase())
      ),
    });

    if (!customer) {
      // Don't reveal if email exists
      return { message: 'Se o email existir, você receberá um link de recuperação' };
    }

    // Generate reset token
    const resetToken = randomBytes(32).toString('hex');
    await db.insert(customerPasswordResets).values({
      tenantId,
      customerId: customer.id,
      token: resetToken,
      expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour
    });

    // Send reset email
    await this.mailService.sendPasswordResetEmail(customer.email, resetToken);

    return { message: 'Se o email existir, você receberá um link de recuperação' };
  }

  async resetPassword(token: string, newPassword: string) {
    const db = this.drizzle.db;

    const resetRecord = await db.query.customerPasswordResets.findFirst({
      where: and(
        eq(customerPasswordResets.token, token),
        gt(customerPasswordResets.expiresAt, new Date()),
        isNull(customerPasswordResets.usedAt),
      ),
    });

    if (!resetRecord) {
      throw new NotFoundException('Token inválido ou expirado');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update customer password
    await db.update(customers)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(customers.id, resetRecord.customerId));

    // Mark token as used
    await db.update(customerPasswordResets)
      .set({ usedAt: new Date() })
      .where(eq(customerPasswordResets.id, resetRecord.id));

    // Invalidate all existing sessions
    await db.delete(customerSessions)
      .where(eq(customerSessions.customerId, resetRecord.customerId));

    return { message: 'Senha alterada com sucesso' };
  }

  async verifyEmail(token: string) {
    const db = this.drizzle.db;

    const verification = await db.query.customerEmailVerifications.findFirst({
      where: and(
        eq(customerEmailVerifications.token, token),
        gt(customerEmailVerifications.expiresAt, new Date()),
        isNull(customerEmailVerifications.usedAt),
      ),
    });

    if (!verification) {
      throw new NotFoundException('Token inválido ou expirado');
    }

    // Update customer
    await db.update(customers)
      .set({ isEmailVerified: true, updatedAt: new Date() })
      .where(eq(customers.id, verification.customerId));

    // Mark token as used
    await db.update(customerEmailVerifications)
      .set({ usedAt: new Date() })
      .where(eq(customerEmailVerifications.id, verification.id));

    return { message: 'Email verificado com sucesso' };
  }

  private async generateTokens(customer: any, ipAddress?: string, userAgent?: string) {
    const payload = {
      sub: customer.id,
      email: customer.email,
      tenantId: customer.tenantId,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_EXPIRES_IN', '15m'),
    });

    const refreshToken = randomBytes(32).toString('hex');
    const refreshExpiresIn = this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d');
    const expiresAt = new Date(Date.now() + this.parseDuration(refreshExpiresIn));

    // Store refresh token
    await this.drizzle.db.insert(customerSessions).values({
      tenantId: customer.tenantId,
      customerId: customer.id,
      token: refreshToken,
      expiresAt,
      ipAddress,
      userAgent,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  private sanitizeCustomer(customer: any) {
    const { password, ...sanitized } = customer;
    return sanitized;
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/(\d+)([dhm])/);
    if (!match) return 7 * 24 * 60 * 60 * 1000; // Default 7 days

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      d: 24 * 60 * 60 * 1000,
      h: 60 * 60 * 1000,
      m: 60 * 1000,
    };

    return value * multipliers[unit];
  }
}
