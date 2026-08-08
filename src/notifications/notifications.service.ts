import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { PreferencesService } from './preferences.service';
import { PushService } from './push.service';
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
    private readonly push: PushService,
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
   *
   * This is the single funnel — bookings, donations, the admin broadcast and
   * every event listener come through here — so it is also where a notification
   * becomes a push. That matters: hooking delivery in at each call site would
   * have meant finding all of them, and missing one is invisible.
   *
   * The preference check above governs both. A user who turned bookings off does
   * not get the row *or* the push, which is the only reading of "off" that isn't
   * a lie.
   *
   * `push: false` is for the broadcast, which sends one multicast for its whole
   * audience instead of one per person — see `broadcastToSegment`.
   */
  async create(
    userId: string,
    kind: string,
    title: string,
    body: string,
    options: { push?: boolean } = {},
  ) {
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

    const notification = await this.prisma.notification.create({
      data: {
        userId,
        kind,
        title,
        body,
      },
    });

    if (options.push !== false) {
      // Awaited, not fire-and-forget: an unawaited promise here would swallow
      // its own failures exactly the way the audit interceptor does (T-14).
      // PushService contains its errors, so this cannot fail the caller.
      await this.push.sendToUser(userId, {
        title,
        body,
        data: { kind, notificationId: notification.id },
      });
    }

    return notification;
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
    const reached: string[] = [];

    for (const userId of userIds) {
      // push: false — the rows are written one at a time because each one checks
      // that user's preferences, but the devices are reached in a single
      // multicast below. A per-user send would be one round trip to Google per
      // recipient, inside one admin request.
      const notification = await this.create(
        userId,
        NotificationKind.SYSTEM,
        dto.title,
        dto.body,
        { push: false },
      );
      if (notification) {
        created++;
        reached.push(userId);
      }
    }

    // Only the users who actually got a row: someone who turned system
    // notifications off must not be pushed to either.
    const push = await this.push.sendToUsers(reached, {
      title: dto.title,
      body: dto.body,
      data: { kind: NotificationKind.SYSTEM },
    });

    this.logger.log(
      `Broadcast sent to segment "${dto.segment}": ${created}/${userIds.length} notifications created, ` +
        `${push.sent} device(s) reached${push.skipped ? ` (push ${push.skipped})` : ''}`,
    );

    return { sent: created, total: userIds.length, devicesReached: push.sent };
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
