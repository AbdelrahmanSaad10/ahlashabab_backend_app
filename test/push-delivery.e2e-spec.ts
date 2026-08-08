import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { PushService } from '../src/notifications/push.service';
import { BatchResponse, MulticastMessage } from '../src/notifications/push.client';

/**
 * Push delivery — row 49.
 *
 * The row was filed **BLOCKED, "FCM key"**. There was nothing for a key to
 * unblock: `firebase-admin` sat in `package.json` and was never imported,
 * `FCM_SERVER_KEY` was read by no code, and `POST /me/device-tokens` filed tokens
 * that nothing ever read. The app asked users for notification permission and
 * stored a token that could not be used.
 *
 * These cover the parts that decide whether a push system stays healthy: dead
 * tokens get removed, FCM's 500-token limit is respected, a failure never
 * escapes to the caller, and "not configured" is a stated outcome rather than
 * silence.
 */

interface FakeClient {
  calls: MulticastMessage[];
  sendEachForMulticast(message: MulticastMessage): Promise<BatchResponse>;
}

/** Every token succeeds. */
const okClient = (): FakeClient => ({
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

/** Tokens listed in `dead` come back with a permanent error. */
const clientRejecting = (dead: string[]): FakeClient => ({
  calls: [],
  async sendEachForMulticast(message) {
    this.calls.push(message);
    const responses = message.tokens.map((t) =>
      dead.includes(t)
        ? { success: false, error: { code: 'messaging/registration-token-not-registered' } }
        : { success: true },
    );
    return {
      successCount: responses.filter((r) => r.success).length,
      failureCount: responses.filter((r) => !r.success).length,
      responses,
    };
  },
});

function fakePrisma(tokens: { userId: string; token: string }[]) {
  const deleted: string[] = [];
  return {
    deleted,
    remaining: () => tokens,
    client: {
      deviceToken: {
        findMany: async ({ where }: any) =>
          tokens.filter((t) => where.userId.in.includes(t.userId)).map((t) => ({ token: t.token })),
        deleteMany: async ({ where }: any) => {
          const gone = where.token.in as string[];
          deleted.push(...gone);
          for (let i = tokens.length - 1; i >= 0; i--) {
            if (gone.includes(tokens[i].token)) tokens.splice(i, 1);
          }
          return { count: gone.length };
        },
      },
    } as any,
  };
}

const payload = { title: 'تحديث حالة الحجز', body: 'تم تأكيد حجزك' };

describe('when no Firebase credential is configured', () => {
  it('is disabled, and says so instead of pretending to send', async () => {
    const prisma = fakePrisma([{ userId: 'u1', token: 't1' }]);
    const service = new PushService(prisma.client, null);

    expect(service.enabled).toBe(false);

    const result = await service.sendToUser('u1', payload);
    expect(result.skipped).toBe('disabled');
    expect(result.sent).toBe(0);
  });

  it('does not even look for device tokens', async () => {
    // The whole project ran in this state. It must be cheap and loud, not a
    // silent trip to the database on every notification.
    let queried = false;
    const prisma = {
      deviceToken: {
        findMany: async () => {
          queried = true;
          return [];
        },
      },
    } as any;

    await new PushService(prisma, null).sendToUser('u1', payload);
    expect(queried).toBe(false);
  });
});

describe('delivering to a user', () => {
  it('sends to every device that user has registered', async () => {
    const prisma = fakePrisma([
      { userId: 'u1', token: 'phone' },
      { userId: 'u1', token: 'tablet' },
      { userId: 'u2', token: 'someone-else' },
    ]);
    const client = okClient();
    const service = new PushService(prisma.client, client);

    const result = await service.sendToUser('u1', payload);

    expect(result.sent).toBe(2);
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0].tokens.sort()).toEqual(['phone', 'tablet']);
    expect(client.calls[0].tokens).not.toContain('someone-else');
    expect(client.calls[0].notification).toEqual(payload);
  });

  it('skips cleanly when the user has no device registered', async () => {
    const prisma = fakePrisma([{ userId: 'someone-else', token: 't' }]);
    const client = okClient();

    const result = await new PushService(prisma.client, client).sendToUser('u1', payload);

    expect(result.skipped).toBe('no-tokens');
    expect(client.calls).toHaveLength(0);
  });
});

describe('dead tokens', () => {
  it('are deleted, so they are not retried forever', async () => {
    /*
     * The part most implementations skip. A token dies when the app is
     * uninstalled or the token rotates, and FCM reports it per token. Left in
     * the table they accumulate for the life of the product, and every later
     * send pays for them.
     */
    const prisma = fakePrisma([
      { userId: 'u1', token: 'alive' },
      { userId: 'u1', token: 'uninstalled' },
    ]);
    const service = new PushService(prisma.client, clientRejecting(['uninstalled']));

    const result = await service.sendToUser('u1', payload);

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.tokensRemoved).toBe(1);
    expect(prisma.deleted).toEqual(['uninstalled']);
    expect(prisma.remaining().map((t) => t.token)).toEqual(['alive']);
  });

  it('keeps a token that failed for a transient reason', async () => {
    // 'unavailable' means try later, not "this device is gone". Deleting on any
    // failure would silently unsubscribe users during an FCM outage.
    const prisma = fakePrisma([{ userId: 'u1', token: 'fine-tomorrow' }]);
    const client: FakeClient = {
      calls: [],
      async sendEachForMulticast(message) {
        this.calls.push(message);
        return {
          successCount: 0,
          failureCount: 1,
          responses: [{ success: false, error: { code: 'messaging/unavailable' } }],
        };
      },
    };

    const result = await new PushService(prisma.client, client).sendToUser('u1', payload);

    expect(result.failed).toBe(1);
    expect(result.tokensRemoved).toBe(0);
    expect(prisma.remaining()).toHaveLength(1);
  });
});

describe('a large audience', () => {
  it('is split into batches of 500, which is FCM\'s limit', async () => {
    const tokens = Array.from({ length: 1201 }, (_, i) => ({ userId: 'u1', token: `t${i}` }));
    const prisma = fakePrisma(tokens);
    const client = okClient();

    const result = await new PushService(prisma.client, client).sendToUsers(['u1'], payload);

    // Exceeding 500 does not truncate — FCM rejects the entire call.
    expect(client.calls.map((c) => c.tokens.length)).toEqual([500, 500, 201]);
    expect(result.sent).toBe(1201);
  });
});

describe('when FCM itself fails', () => {
  it('never throws — the caller has already done the real work', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const prisma = fakePrisma([{ userId: 'u1', token: 't1' }]);
    const client: FakeClient = {
      calls: [],
      async sendEachForMulticast() {
        throw new Error('ECONNREFUSED fcm.googleapis.com');
      },
    };

    try {
      // A booking is confirmed and the notification row is written before this
      // runs. An unreachable Google must not turn that into a 500.
      const result = await new PushService(prisma.client, client).sendToUser('u1', payload);
      expect(result.failed).toBe(1);
      expect(result.sent).toBe(0);

      // Contained, but not silent — the mistake to avoid is the empty catch that
      // hid the OTP send failure for the whole project.
      expect(error).toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });
});
