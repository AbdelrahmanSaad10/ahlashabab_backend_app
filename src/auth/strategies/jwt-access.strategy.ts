import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  type: 'user' | 'admin';
  roleId?: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.type === 'admin') {
      const adminUser = await this.prisma.adminUser.findUnique({
        where: { id: payload.sub },
        include: { role: true },
      });

      if (!adminUser || !adminUser.active) {
        throw new UnauthorizedException('حساب المسؤول غير موجود أو معطل');
      }

      // Return object with adminUser key so the guard sets request.adminUser
      return { adminUser };
    }

    // Default: user type
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('المستخدم غير موجود');
    }

    if (user.blocked) {
      throw new UnauthorizedException('تم حظر هذا الحساب');
    }

    return { user };
  }
}
