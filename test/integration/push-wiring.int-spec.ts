import 'reflect-metadata';
import { integrationDb } from './db';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { PreferencesService } from '../../src/notifications/preferences.service';
import { PushService } from '../../src/notifications/push.service';
import { BatchResponse, MulticastMessage } from '../../src/notifications/push.client';
import { NotificationKind, NotificationPrefKey } from '../../src/common/constants/statuses';

/**
 * That a notification actually becomes a push — against a real database.
 *
 * `push.service.spec` proves the sender in isolation. This proves the **wiring**,
 * which is the half that was missing for the whole project: device tokens were
 * collected and stored and no code ever read them.
 *
 * Delivery is hooked into `NotificationsService.create`, the single funnel every
 * notification passes through — bookings, donations, the admin broadcast, every
 * event listener. Hooking it in per call site would have meant finding them all,
 * and a missed one is invisible: the row appears in the feed and the phone stays
 * quiet.
 */

const prisma = integrationDb();

const TAG = 'INT-PUSH';

interface FakeClient {
  calls: MulticastMessage[];
  sendEachForMulticast(message: MulticastMessage): Promise<BatchResponse>;
}

const fakeClient = (): FakeClient => ({
  calls: [],
  async sendEachForMulticast(message) {
    this.calls.push(message);
    return {
      successCount: message.tokens.length,
      failureCount: 0,
      responses: message.tokens.map(() => ({ success: true })),
    };
  },
});

let client: FakeClient;
let notifications: NotificationsService;

const build = (pushClient: FakeClient | null) => {
  const push = new PushService(prisma as any, pushClient);
  return new NotificationsService(prisma as any, new PreferencesService(prisma as any), push);
};

const clean = async () => {
  const users = await prisma.user.findMany({ where: { email: { startsWith: TAG } } });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.notificationPreference.deleteMany({ where: { userId: { in: ids } } });
    await prisma.deviceToken.deleteMany({ where: { userId: { in: ids } } });
  }
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
};

const makeUser = async (suffix: string, withDevice = true) => {
  const user = await prisma.user.create({
    data: { email: `${TAG}-${suffix}@test.local`, name: `push ${suffix}` },
  });
  if (withDevice) {
    await prisma.deviceToken.create({
      data: { userId: user.id, token: `${TAG}-token-${suffix}`, platform: 'android' },
    });
  }
  return user;
};

beforeAll(async () => {
  await prisma.$connect();
  await clean();
});

afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await clean();
  client = fakeClient();
  notifications = build(client);
});

describe('creating a notification reaches the device', () => {
  it('writes the in-app row and pushes to that user', async () => {
    const user = await makeUser('a');

    const created = await notifications.create(
      user.id,
      NotificationKind.BOOKING,
      'تم تأكيد حجزك',
      'حجزك رقم AS-1 مؤكد',
    );

    expect(created).not.toBeNull();
    const rows = await prisma.notification.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);

    expect(client.calls).toHaveLength(1);
    expect(client.calls[0].tokens).toEqual([`${TAG}-token-a`]);
    expect(client.calls[0].notification.title).toBe('تم تأكيد حجزك');
    // The app needs to know what it was handed to route the tap.
    expect(client.calls[0].data?.kind).toBe(NotificationKind.BOOKING);
    expect(client.calls[0].data?.notificationId).toBe(rows[0].id);
  });

  it('writes the row even when no device is registered', async () => {
    const user = await makeUser('no-device', false);

    const created = await notifications.create(
      user.id,
      NotificationKind.BOOKING,
      'عنوان',
      'نص',
    );

    expect(created).not.toBeNull();
    expect(client.calls).toHaveLength(0);
  });
});

describe('a disabled preference silences both', () => {
  it('writes no row and sends no push', async () => {
    const user = await makeUser('opted-out');
    await prisma.notificationPreference.create({
      data: { userId: user.id, key: NotificationPrefKey.BOOKINGS, enabled: false },
    });

    const created = await notifications.create(
      user.id,
      NotificationKind.BOOKING,
      'عنوان',
      'نص',
    );

    // "Off" has to mean off. A push for a notification the user asked not to
    // receive is worse than the row, because it interrupts them.
    expect(created).toBeNull();
    expect(await prisma.notification.count({ where: { userId: user.id } })).toBe(0);
    expect(client.calls).toHaveLength(0);
  });
});

describe('the admin broadcast', () => {
  it('sends ONE multicast for the whole audience, not one per person', async () => {
    const users = await Promise.all([makeUser('b1'), makeUser('b2'), makeUser('b3')]);

    const result = await notifications.broadcastToSegment({
      segment: 'all',
      title: 'إعلان',
      body: 'رسالة للجميع',
    } as any);

    expect(result.sent).toBeGreaterThanOrEqual(users.length);

    // The reason `create` takes `push: false`. One round trip to Google per
    // recipient, inside one admin request, is how a broadcast times out.
    expect(client.calls).toHaveLength(1);
    for (const u of users) {
      expect(client.calls[0].tokens).toContain(`${TAG}-token-${u.email.split('-')[2].split('@')[0]}`);
    }
  });

  it('does not push to someone who turned system notifications off', async () => {
    const wanted = await makeUser('wants');
    const optedOut = await makeUser('declines');
    await prisma.notificationPreference.create({
      data: { userId: optedOut.id, key: NotificationPrefKey.SYSTEM, enabled: false },
    });

    await notifications.broadcastToSegment({
      segment: 'all',
      title: 'إعلان',
      body: 'رسالة',
    } as any);

    const tokens = client.calls.flatMap((c) => c.tokens);
    expect(tokens).toContain(`${TAG}-token-wants`);
    expect(tokens).not.toContain(`${TAG}-token-declines`);
    expect(wanted.id).toBeTruthy();
  });
});

describe('with push disabled — the state this project shipped in', () => {
  it('still delivers to the in-app feed', async () => {
    const offline = build(null);
    const user = await makeUser('feed-only');

    const created = await offline.create(user.id, NotificationKind.BOOKING, 'عنوان', 'نص');

    expect(created).not.toBeNull();
    expect(await prisma.notification.count({ where: { userId: user.id } })).toBe(1);
  });
});
