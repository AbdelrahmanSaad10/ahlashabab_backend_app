import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { PreferencesService } from './preferences.service';
import { BroadcastDto } from './dto/broadcast.dto';
import { NotificationKind, NotificationPrefKey } from '../common/constants/statuses';

/** Map notification kinds to preference keys */
const KIND_TO_PREF: Record<string, string> = {
  [NotificationKind.DONATION]: NotificationPrefKey.DONATIONS,
  [NotificationKind.CASE]: NotificationPrefKey.CASES,
  [NotificationKind.PROJECT]: NotificationPrefKey.PROJECTS,
  [NotificationKind.BOOKING]: NotificationPrefKey.BOOKINGS,
  [NotificationKind.SYSTEM]: NotificationPrefKey.SYSTEM,
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly preferences: PreferencesService,
  ) {}

  /**
   * Get paginated notification feed for a user, plus unread count.
   */
  async getUserNotifications(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [data, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, read: false } }),
    ]);

    return {
      data,
      unreadCount,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Mark a single notification as read.
   */
  async markRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('الإشعار غير موجود');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
  }

  /**
   * Mark all notifications for a user as read.
   */
  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    return { success: true };
  }

  /**
   * Get count of unread notifications for a user.
   */
  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, read: false },
    });

    return { unreadCount: count };
  }

  /**
   * Create an in-app notification (checks user preferences first).
   */
  async create(userId: string, kind: string, title: string, body: string) {
    // Check if user has this notification type enabled
    const prefKey = KIND_TO_PREF[kind];
    if (prefKey) {
      const enabled = await this.preferences.isEnabled(userId, prefKey);
      if (!enabled) {
        this.logger.debug(
          `Notification skipped for user ${userId}: preference "${prefKey}" is disabled`,
        );
        return null;
      }
    }

    return this.prisma.notification.create({
      data: {
        userId,
        kind,
        title,
        body,
      },
    });
  }

  /**
   * Admin: broadcast a notification to a user segment.
   * Respects individual user preferences.
   */
  async broadcastToSegment(dto: BroadcastDto) {
    let userIds: string[] = [];

    switch (dto.segment) {
      case 'all':
        userIds = (
          await this.prisma.user.findMany({
            where: { blocked: false },
            select: { id: true },
          })
        ).map((u) => u.id);
        break;

      case 'donors':
        userIds = (
          await this.prisma.donation.findMany({
            where: { userId: { not: null } },
            select: { userId: true },
            distinct: ['userId'],
          })
        )
          .filter((d) => d.userId !== null)
          .map((d) => d.userId as string);
        break;

      case 'governorate':
        if (!dto.governorateId) {
          throw new NotFoundException('يجب تحديد المحافظة');
        }
        userIds = (
          await this.prisma.user.findMany({
            where: {
              governorateId: dto.governorateId,
              blocked: false,
            },
            select: { id: true },
          })
        ).map((u) => u.id);
        break;
    }

    let created = 0;

    for (const userId of userIds) {
      const notification = await this.create(
        userId,
        NotificationKind.SYSTEM,
        dto.title,
        dto.body,
      );
      if (notification) created++;
    }

    this.logger.log(
      `Broadcast sent to segment "${dto.segment}": ${created}/${userIds.length} notifications created`,
    );

    return { sent: created, total: userIds.length };
  }

  // ----------------------------------------------------------------
  // Event listeners
  // ----------------------------------------------------------------

  @OnEvent('booking.created')
  async onBookingCreated(payload: {
    userId?: string;
    reference: string;
    serviceName?: string;
  }) {
    if (!payload.userId) return;

    await this.create(
      payload.userId,
      NotificationKind.BOOKING,
      'تم إنشاء حجز جديد',
      `تم تسجيل حجزك بنجاح برقم ${payload.reference}`,
    );
  }

  @OnEvent('booking.statusChanged')
  async onBookingStatusChanged(payload: {
    userId?: string;
    reference: string;
    status: string;
  }) {
    if (!payload.userId) return;

    await this.create(
      payload.userId,
      NotificationKind.BOOKING,
      'تحديث حالة الحجز',
      `تم تحديث حالة حجزك ${payload.reference} إلى "${payload.status}"`,
    );
  }

  @OnEvent('donation.completed')
  async onDonationCompleted(payload: {
    userId?: string;
    reference: string;
    amount: number;
    donorName: string;
  }) {
    if (!payload.userId) return;

    await this.create(
      payload.userId,
      NotificationKind.DONATION,
      'تم تأكيد تبرعك',
      `تم تأكيد تبرعك بمبلغ ${payload.amount} جنيه. شكراً لدعمك!`,
    );
  }
}
