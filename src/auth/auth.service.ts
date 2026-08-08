import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { normalizeEmail } from '../common/utils/email.util';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface AccessTokenPayload {
  sub: string;
  email: string;
  type: 'user' | 'admin';
  roleId?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  // ----------------------------------------------------------------
  // OTP Flow
  // ----------------------------------------------------------------

  async requestOtp(email: string): Promise<{ message: string }> {
    const normalized = normalizeEmail(email);

    // Generate 6-digit OTP code
    const code = Math.floor(100_000 + Math.random() * 900_000).toString();

    // Parse OTP TTL (e.g. "10m" -> 10 minutes)
    const ttl = this.config.get<string>('OTP_TTL') ?? '10m';
    const ttlMs = this.parseTtlToMs(ttl);
    const expiresAt = new Date(Date.now() + ttlMs);

    // Invalidate previous unused OTPs for this email
    await this.prisma.otpCode.updateMany({
      where: { email: normalized, used: false },
      data: { used: true },
    });

    // Store OTP in DB
    await this.prisma.otpCode.create({
      data: {
        email: normalized,
        code,
        expiresAt,
      },
    });

    // Send OTP via email
    await this.email.sendOtp(normalized, code);

    this.logger.log(`OTP requested for ${normalized}`);

    return { message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني' };
  }

  async verifyOtp(
    email: string,
    code: string,
  ): Promise<TokenPair & { user: { id: string; email: string; name: string | null } }> {
    const normalized = normalizeEmail(email);

    // Find latest unused OTP for this email
    const otp = await this.prisma.otpCode.findFirst({
      where: { email: normalized, used: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new BadRequestException('رمز التحقق غير صالح أو منتهي الصلاحية');
    }

    // Check expiration
    if (new Date() > otp.expiresAt) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { used: true },
      });
      throw new BadRequestException('رمز التحقق منتهي الصلاحية');
    }

    // Check max attempts
    if (otp.attempts >= 5) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { used: true },
      });
      throw new BadRequestException('تم تجاوز عدد المحاولات المسموح بها');
    }

    // Verify code
    if (otp.code !== code) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('رمز التحقق غير صحيح');
    }

    // Mark OTP as used
    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { used: true },
    });

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { email: normalized },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: { email: normalized },
      });
      this.logger.log(`New user created: ${normalized}`);
    }

    // Generate JWT tokens
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      type: 'user',
    };

    const tokens = await this.generateTokens(payload);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  // ----------------------------------------------------------------
  // Admin Login
  // ----------------------------------------------------------------

  async adminLogin(
    email: string,
    password: string,
  ): Promise<TokenPair & { admin: { id: string; email: string; name: string; roleId: string } }> {
    const normalized = normalizeEmail(email);

    const adminUser = await this.prisma.adminUser.findUnique({
      where: { email: normalized },
      include: { role: true },
    });

    if (!adminUser) {
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }

    if (!adminUser.active) {
      throw new UnauthorizedException('هذا الحساب معطل');
    }

    // Verify password with argon2
    const valid = await argon2.verify(adminUser.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }

    const payload: AccessTokenPayload = {
      sub: adminUser.id,
      email: adminUser.email,
      type: 'admin',
      roleId: adminUser.roleId,
    };

    const tokens = await this.generateTokens(payload);

    return {
      ...tokens,
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        roleId: adminUser.roleId,
      },
    };
  }

  // ----------------------------------------------------------------
  // Admin Password Change
  // ----------------------------------------------------------------

  /**
   * Rotate an administrator's own password.
   *
   * Nothing in the product could do this before, which is why the seeded
   * password — published in a public repository — stayed live. Three things
   * happen together and deliberately:
   *
   * 1. the current password is verified, so a stolen access token alone cannot
   *    take the account over;
   * 2. **every refresh token for this admin is revoked**, so if the old password
   *    had leaked, the sessions it opened die with it. Without this, rotating
   *    the password evicts nobody for up to 30 days;
   * 3. an audit row is written *here* rather than by `ActivityLogInterceptor`.
   *    The interceptor stores `newValue: request.body`, so wiring it to this
   *    route would put both passwords in the activity log in plain text.
   */
  async changeAdminPassword(
    adminId: string,
    currentPassword: string,
    newPassword: string,
    context: { ip?: string; userAgent?: string } = {},
  ): Promise<{ message: string }> {
    const adminUser = await this.prisma.adminUser.findUnique({ where: { id: adminId } });

    if (!adminUser || !adminUser.active) {
      throw new UnauthorizedException('حساب المسؤول غير موجود أو معطل');
    }

    const valid = await argon2.verify(adminUser.passwordHash, currentPassword);
    if (!valid) {
      throw new UnauthorizedException('كلمة المرور الحالية غير صحيحة');
    }

    const passwordHash = await argon2.hash(newPassword);

    await this.prisma.$transaction([
      this.prisma.adminUser.update({
        where: { id: adminId },
        data: { passwordHash },
      }),
      this.prisma.refreshToken.updateMany({
        where: { adminUserId: adminId, revoked: false },
        data: { revoked: true },
      }),
      this.prisma.activityLog.create({
        data: {
          actorId: adminId,
          action: 'update',
          entityType: 'admin-password',
          entityId: adminId,
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
        },
      }),
    ]);

    this.logger.log(`Password changed for admin ${adminUser.email}`);

    return { message: 'تم تغيير كلمة المرور بنجاح. برجاء تسجيل الدخول من جديد.' };
  }

  // ----------------------------------------------------------------
  // Refresh Tokens
  // ----------------------------------------------------------------

  async refreshTokens(token: string): Promise<TokenPair> {
    // Find the refresh token in the database
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token },
    });

    if (!storedToken) {
      throw new UnauthorizedException('رمز التحديث غير صالح');
    }

    if (storedToken.revoked) {
      throw new UnauthorizedException('رمز التحديث تم إبطاله');
    }

    if (new Date() > storedToken.expiresAt) {
      throw new UnauthorizedException('رمز التحديث منتهي الصلاحية');
    }

    // Revoke the old refresh token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    });

    // Determine the payload based on whether it's a user or admin token
    if (storedToken.adminUserId) {
      const adminUser = await this.prisma.adminUser.findUnique({
        where: { id: storedToken.adminUserId },
      });

      if (!adminUser || !adminUser.active) {
        throw new UnauthorizedException('حساب المسؤول غير موجود أو معطل');
      }

      return this.generateTokens({
        sub: adminUser.id,
        email: adminUser.email,
        type: 'admin',
        roleId: adminUser.roleId,
      });
    }

    if (storedToken.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: storedToken.userId },
      });

      if (!user) {
        throw new UnauthorizedException('المستخدم غير موجود');
      }

      if (user.blocked) {
        throw new UnauthorizedException('تم حظر هذا الحساب');
      }

      return this.generateTokens({
        sub: user.id,
        email: user.email,
        type: 'user',
      });
    }

    throw new UnauthorizedException('رمز التحديث غير صالح');
  }

  // ----------------------------------------------------------------
  // Logout
  // ----------------------------------------------------------------

  async logout(token: string): Promise<{ message: string }> {
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token },
    });

    if (storedToken && !storedToken.revoked) {
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revoked: true },
      });
    }

    return { message: 'تم تسجيل الخروج بنجاح' };
  }

  // ----------------------------------------------------------------
  // Private Helpers
  // ----------------------------------------------------------------

  private async generateTokens(payload: AccessTokenPayload): Promise<TokenPair> {
    const accessTtl = this.config.get<string>('JWT_ACCESS_TTL') ?? '15m';
    const refreshTtl = this.config.get<string>('JWT_REFRESH_TTL') ?? '30d';
    const refreshTtlMs = this.parseTtlToMs(refreshTtl);

    const tokenId = uuidv4();

    // Create access token
    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: accessTtl,
    });

    // Create refresh token with tokenId
    const refreshToken = this.jwt.sign(
      { ...payload, tokenId },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshTtl,
      },
    );

    // Store refresh token in DB
    const expiresAt = new Date(Date.now() + refreshTtlMs);

    await this.prisma.refreshToken.create({
      data: {
        id: tokenId,
        token: refreshToken,
        userId: payload.type === 'user' ? payload.sub : null,
        adminUserId: payload.type === 'admin' ? payload.sub : null,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private parseTtlToMs(ttl: string): number {
    const match = ttl.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 10 * 60 * 1000; // default 10 minutes

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 10 * 60 * 1000;
    }
  }
}
