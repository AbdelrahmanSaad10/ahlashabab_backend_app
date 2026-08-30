import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { governorate: true },
    });

    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    return user;
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    await this.findById(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        phone: dto.phone,
        governorateId: dto.governorateId,
        bio: dto.bio,
      },
      include: { governorate: true },
    });
  }

  async getUserBookings(userId: string) {
    return this.prisma.booking.findMany({
      where: { userId },
      include: {
        service: { include: { category: true } },
        provider: true,
        governorate: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  async getUserDonations(userId: string) {
    return this.prisma.donation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserConsultations(userId: string) {
    return this.prisma.consultationRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addFavorite(userId: string, entityType: string, entityId: string) {
    return this.prisma.favorite.upsert({
      where: {
        userId_entityType_entityId: {
          userId,
          entityType,
          entityId,
        },
      },
      create: { userId, entityType, entityId },
      update: {},
    });
  }

  async removeFavorite(userId: string, entityType: string, entityId: string) {
    return this.prisma.favorite.deleteMany({
      where: { userId, entityType, entityId },
    });
  }

  async getFavorites(userId: string) {
    return this.prisma.favorite.findMany({
      where: { userId },
    });
  }

  /**
   * Delete the signed-in person's account.
   *
   * Google Play requires any app that lets people create an account to let them
   * delete it, from inside the app and from a web page. There was no way to do
   * either: no control in the app, and no endpoint but `DELETE /me/favorites`.
   *
   * What is destroyed and what survives is a deliberate line, not a technical
   * one:
   *
   *   **Destroyed** — everything that identifies the person. The account row
   *   itself, and by cascade their notifications, preferences, device tokens,
   *   saved favourites and sessions. Their unused login codes go too.
   *
   *   **Anonymised, not destroyed** — the records the foundation has a real
   *   reason to keep. A donation stays as an amount, a method and a reference so
   *   the books still balance; the donor's name goes. A booking stays so the
   *   slot's history is intact; the name, phone, notes and **national ID** go. A
   *   consultation stays as "a request of this type happened on this date"; the
   *   contact details and — the part that matters — **the person's written
   *   account of their circumstances** are erased.
   *
   * A limitation worth stating rather than hiding: volunteer applications and
   * contact messages carry no link to an account, only a name and a phone
   * number. They cannot be matched reliably and are not touched here. Someone
   * asking for complete erasure has to be handled by hand, which is what the
   * 30-day commitment in the privacy policy is for.
   */
  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('المستخدم غير موجود');

    const REDACTED = 'حساب محذوف';

    const [bookings, donations, consultations] = await this.prisma.$transaction([
      // Detached and stripped. The slot, date and status stay — they are the
      // provider's record, not the person's.
      this.prisma.booking.updateMany({
        where: { userId },
        data: { userId: null, applicantName: REDACTED, phone: REDACTED, nationalId: null, notes: null },
      }),
      // The ledger survives; the donor does not.
      this.prisma.donation.updateMany({
        where: { userId },
        data: { userId: null, donorName: REDACTED },
      }),
      // `summary` is the person's own description of their situation. It is the
      // single most sensitive column in the schema, and erasure has to reach it.
      this.prisma.consultationRequest.updateMany({
        where: { userId },
        data: {
          userId: null,
          name: REDACTED,
          phone: REDACTED,
          whatsapp: null,
          email: REDACTED,
          age: null,
          summary: null,
          extraFieldsJson: undefined,
        },
      }),
      this.prisma.otpCode.deleteMany({ where: { email: user.email } }),
      // Cascades to refresh tokens, notifications, preferences, device tokens
      // and favourites — which is also what ends every session they had open.
      this.prisma.user.delete({ where: { id: userId } }),
    ]);

    this.logger.log(
      `Account deleted: ${userId} — ${bookings.count} booking(s), ${donations.count} donation(s), ` +
        `${consultations.count} consultation(s) anonymised`,
    );

    return {
      message: 'تم حذف حسابك وبياناتك الشخصية.',
      anonymised: {
        bookings: bookings.count,
        donations: donations.count,
        consultations: consultations.count,
      },
    };
  }

  async registerDeviceToken(
    userId: string,
    token: string,
    platform: string,
  ) {
    return this.prisma.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
  }

  // ── Admin helpers ──────────────────────────────

  async findAll(filters: {
    q?: string;
    governorate?: string;
    isGuest?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { q, governorate, isGuest, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (governorate) {
      where.governorate = {
        name: { contains: governorate, mode: 'insensitive' },
      };
    }

    if (isGuest !== undefined) {
      where.isGuest = isGuest;
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { governorate: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async toggleBlock(id: string) {
    const user = await this.findById(id);

    return this.prisma.user.update({
      where: { id },
      data: { blocked: !user.blocked },
    });
  }

  async exportUsers() {
    const users = await this.prisma.user.findMany({
      include: { governorate: true },
      orderBy: { createdAt: 'desc' },
    });

    const header = 'الاسم,البريد الإلكتروني,الهاتف,المحافظة,ضيف,محظور,تاريخ التسجيل';
    const rows = users.map(
      (u) =>
        `"${u.name || ''}","${u.email}","${u.phone || ''}","${u.governorate?.name || ''}","${u.isGuest ? 'نعم' : 'لا'}","${u.blocked ? 'نعم' : 'لا'}","${u.createdAt.toISOString()}"`,
    );

    return [header, ...rows].join('\n');
  }
}
