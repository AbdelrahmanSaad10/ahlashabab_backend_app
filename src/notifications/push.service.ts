import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PUSH_CLIENT, PushClient } from './push.client';

/**
 * Delivering a notification to a device.
 *
 * Row 49 was filed BLOCKED on an FCM key. There was no send path to unblock:
 * `firebase-admin` sat in `package.json` and was never imported, `FCM_SERVER_KEY`
 * was read by nothing, and `POST /me/device-tokens` filed tokens that no code
 * ever read. The app asked users for notification permission and stored a token
 * that could not be used.
 *
 * Three things this service treats as load-bearing:
 *
 *   - **A push failure never breaks the thing that caused it.** The in-app
 *     notification row is already written by the time we get here; a dead token
 *     or an unreachable FCM must not turn a successful booking into a 500.
 *   - **Dead tokens are deleted.** FCM reports per-token failures, and
 *     `registration-token-not-registered` means the app was uninstalled or the
 *     token rotated. Left in place they accumulate forever, and every later send
 *     pays for them. This is the part most implementations skip.
 *   - **Disabled is stated, not silent.** With no credential the client is null
 *     and every call records why at debug level, having already said so once at
 *     boot.
 */

/** FCM's own limit for a multicast. Exceed it and the whole call is rejected. */
const MAX_TOKENS_PER_CALL = 500;

/** Errors that mean the token is gone for good, rather than a transient failure. */
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

export interface PushPayload {
  title: string;
  body: string;
  /** FCM requires every data value to be a string. */
  data?: Record<string, string>;
}

export interface PushResult {
  sent: number;
  failed: number;
  tokensRemoved: number;
  skipped?: 'disabled' | 'no-tokens';
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(PUSH_CLIENT) private readonly client: PushClient | null = null,
  ) {}

  get enabled(): boolean {
    return this.client !== null;
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<PushResult> {
    return this.sendToUsers([userId], payload);
  }

  /**
   * One multicast for the whole audience, not one call per person.
   *
   * The broadcast path hands this thousands of ids; a per-user send would be
   * thousands of sequential round trips to Google inside one admin request.
   */
  async sendToUsers(userIds: string[], payload: PushPayload): Promise<PushResult> {
    const empty: PushResult = { sent: 0, failed: 0, tokensRemoved: 0 };

    if (!this.client) {
      this.logger.debug('Push skipped: no Firebase credential configured');
      return { ...empty, skipped: 'disabled' };
    }
    if (userIds.length === 0) return { ...empty, skipped: 'no-tokens' };

    const devices = await this.prisma.deviceToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true },
    });

    if (devices.length === 0) {
      this.logger.debug(`Push skipped: no device tokens for ${userIds.length} user(s)`);
      return { ...empty, skipped: 'no-tokens' };
    }

    const tokens = devices.map((d) => d.token);
    const result: PushResult = { sent: 0, failed: 0, tokensRemoved: 0 };

    for (let i = 0; i < tokens.length; i += MAX_TOKENS_PER_CALL) {
      const batch = tokens.slice(i, i + MAX_TOKENS_PER_CALL);
      await this.sendBatch(batch, payload, result);
    }

    return result;
  }

  private async sendBatch(tokens: string[], payload: PushPayload, result: PushResult) {
    try {
      const response = await this.client!.sendEachForMulticast({
        tokens,
        notification: { title: payload.title, body: payload.body },
        ...(payload.data ? { data: payload.data } : {}),
      });

      result.sent += response.successCount;
      result.failed += response.failureCount;

      const dead = tokens.filter((_, index) => {
        const r = response.responses[index];
        return r && !r.success && r.error?.code && DEAD_TOKEN_CODES.has(r.error.code);
      });

      if (dead.length > 0) {
        const { count } = await this.prisma.deviceToken.deleteMany({
          where: { token: { in: dead } },
        });
        result.tokensRemoved += count;
        this.logger.log(`Removed ${count} dead device token(s)`);
      }
    } catch (err) {
      /*
       * Contained on purpose. The caller has already written the in-app
       * notification, and the user's booking or donation must not fail because
       * Google was unreachable. Logged at error level so it is not invisible —
       * the mistake to avoid is a catch that says nothing, which is how the OTP
       * send failure hid for the whole project (T-06).
       */
      result.failed += tokens.length;
      this.logger.error(
        `Push delivery failed for ${tokens.length} token(s): ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }
}
