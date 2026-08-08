import { INestApplication } from '@nestjs/common';

/**
 * Teaching Express which proxies to believe.
 *
 * `request.ip` decides the rate limiter's bucket and the `ip` recorded in the
 * admin activity log. Express derives it from `X-Forwarded-For` only when the
 * proxy chain is trusted; otherwise it is the socket peer, which behind a proxy
 * is one and the same address for every caller.
 *
 * That was the state of this deployment: Cloudflare and nginx in front, no
 * setting, so the limits below applied to the entire platform at once —
 *
 *   - 100 requests per minute, shared by every user;
 *   - 5 admin login attempts per 10 minutes, shared by every administrator;
 *   - 5 OTP requests per 10 minutes, shared by every person trying to log into
 *     the mobile app.
 *
 * The opposite mistake is just as real: trusting a hop that does not exist lets
 * a caller write their own `X-Forwarded-For` and get a fresh bucket per request,
 * which removes the limits altogether. So the value is explicit, and whatever it
 * resolves to is stated at boot.
 */

export type TrustProxySetting = boolean | number | string[];

export function parseTrustProxy(raw: string | undefined): TrustProxySetting {
  const value = (raw ?? '').trim();

  if (value === '' || value.toLowerCase() === 'false') return false;
  if (value.toLowerCase() === 'true') return true;
  if (/^\d+$/.test(value)) return Number(value);

  // Anything else is a list Express understands: 'loopback', 'uniquelocal', or
  // explicit addresses and CIDR ranges.
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function describeTrustProxy(setting: TrustProxySetting): string {
  if (setting === false) {
    return (
      'TRUST_PROXY=false — the client IP is the socket peer. If anything proxies this ' +
      'process (nginx, Cloudflare, a load balancer), every caller shares ONE rate-limit ' +
      'bucket and the activity log records the proxy. Set TRUST_PROXY to the number of ' +
      'proxies that rewrite X-Forwarded-For.'
    );
  }
  if (setting === true) {
    return (
      'TRUST_PROXY=true — the whole forwarded chain is trusted, so a caller can set ' +
      'X-Forwarded-For themselves and bypass every rate limit. Use a hop count instead ' +
      'unless this process is unreachable except through a proxy.'
    );
  }
  if (typeof setting === 'number') {
    return `TRUST_PROXY=${setting} — the client IP is taken ${setting} hop(s) back along X-Forwarded-For.`;
  }
  return `TRUST_PROXY=[${setting.join(', ')}] — those proxies are trusted; the client IP is the first address beyond them.`;
}

export function applyTrustProxy(app: INestApplication, raw: string | undefined): TrustProxySetting {
  const setting = parseTrustProxy(raw);
  const express = app.getHttpAdapter().getInstance();
  express.set('trust proxy', setting);
  console.log(describeTrustProxy(setting));
  return setting;
}
