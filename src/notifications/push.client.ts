import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * The Firebase credential, and why the one in `.env.example` cannot work.
 *
 * Row 49 was filed BLOCKED on an **FCM server key**. That key authenticates the
 * *legacy* FCM HTTP API, which Google deprecated in June 2023 and **shut down on
 * 20 June 2024**. Obtaining one would have produced a credential that no longer
 * authenticates anything — the request in the audit was for a dead artefact.
 *
 * `firebase-admin` speaks the HTTP v1 API, which authenticates with a **service
 * account**: Firebase console → Project settings → Service accounts → Generate
 * new private key. That JSON is what this reads, either inline in
 * `FIREBASE_SERVICE_ACCOUNT` or as a path in `FIREBASE_SERVICE_ACCOUNT_PATH`.
 *
 * Absent either, the client is `null` and push is **disabled, loudly** — one line
 * at boot saying so. Notifications still land in the in-app feed; they simply do
 * not ring anyone's phone. A silent no-op is how this went unnoticed for the
 * whole project.
 */

/** The one method used, kept narrow so tests need no Firebase at all. */
export interface PushClient {
  sendEachForMulticast(message: MulticastMessage): Promise<BatchResponse>;
}

export interface MulticastMessage {
  tokens: string[];
  notification: { title: string; body: string };
  data?: Record<string, string>;
}

export interface BatchResponse {
  successCount: number;
  failureCount: number;
  responses: { success: boolean; error?: { code?: string } }[];
}

export const PUSH_CLIENT = 'PUSH_CLIENT';

const logger = new Logger('PushClient');

function readServiceAccount(config: ConfigService): Record<string, unknown> | null {
  const inline = config.get<string>('FIREBASE_SERVICE_ACCOUNT');
  const path = config.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');

  const raw = (() => {
    if (inline && inline.trim()) return inline;
    if (path && path.trim()) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require('fs');
      if (!fs.existsSync(path)) {
        logger.error(`FIREBASE_SERVICE_ACCOUNT_PATH points at ${path}, which does not exist`);
        return null;
      }
      return fs.readFileSync(path, 'utf8');
    }
    return null;
  })();

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    // Deliberately does not echo the value: it is a private key.
    logger.error('The Firebase service account is not valid JSON — push is disabled');
    return null;
  }
}

export function createPushClient(config: ConfigService): PushClient | null {
  if (config.get<string>('FCM_SERVER_KEY')) {
    logger.warn(
      'FCM_SERVER_KEY is set and is ignored. It authenticates the legacy FCM API, which ' +
        'Google shut down on 20 June 2024. Push needs a service account — set ' +
        'FIREBASE_SERVICE_ACCOUNT (or _PATH) instead.',
    );
  }

  const serviceAccount = readServiceAccount(config);

  if (!serviceAccount) {
    logger.warn(
      'Push notifications are DISABLED: no FIREBASE_SERVICE_ACCOUNT configured. ' +
        'Notifications will appear in the in-app feed and reach no device.',
    );
    return null;
  }

  try {
    // Required lazily so that a project with no Firebase configured never pays
    // for loading the SDK, and so this module stays importable in tests.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const admin = require('firebase-admin');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getMessaging } = require('firebase-admin/messaging');

    const app = admin.apps?.length
      ? admin.apps[0]
      : admin.initializeApp({ credential: admin.credential.cert(serviceAccount as never) });

    logger.log(`Push notifications enabled (project ${serviceAccount.project_id ?? 'unknown'})`);
    return getMessaging(app) as PushClient;
  } catch (err) {
    logger.error(
      `Push notifications are DISABLED: Firebase failed to initialise — ${
        err instanceof Error ? err.message : err
      }`,
    );
    return null;
  }
}
