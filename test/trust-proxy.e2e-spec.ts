import 'reflect-metadata';
import {
  applyTrustProxy,
  describeTrustProxy,
  parseTrustProxy,
} from '../src/common/utils/trust-proxy.util';

/**
 * Which address counts as "the caller" — T-06.
 *
 * Nothing set `trust proxy`, and the deployment answers through Cloudflare and
 * an nginx. So `request.ip` was the proxy for every request, and everything
 * keyed on it collapsed into one value: the rate limiter's bucket (100 req/min
 * for the whole platform, 5 admin logins per 10 minutes for every administrator
 * together, 5 OTP requests per 10 minutes for the entire mobile user base) and
 * the `ip` column of the admin activity log.
 *
 * It stayed invisible because a missing setting has no error message. Hence both
 * halves of this: a parser that accepts an explicit value, and a description
 * printed at boot so the effective setting is always on the record.
 */

describe('reading the TRUST_PROXY setting', () => {
  it('defaults to trusting nothing', () => {
    // An absent value must not silently start honouring X-Forwarded-For: a
    // caller could then set their own and get a private rate-limit bucket.
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy('')).toBe(false);
    expect(parseTrustProxy('   ')).toBe(false);
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('FALSE')).toBe(false);
  });

  it('reads a hop count, which is the form to use behind nginx or Cloudflare', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('2')).toBe(2);
    expect(parseTrustProxy(' 3 ')).toBe(3);
  });

  it('reads an explicit list of trusted proxies', () => {
    expect(parseTrustProxy('loopback, 10.0.0.0/8')).toEqual(['loopback', '10.0.0.0/8']);
  });

  it('allows blanket trust, but says what it costs', () => {
    expect(parseTrustProxy('true')).toBe(true);
    expect(describeTrustProxy(true)).toMatch(/bypass every rate limit/);
  });
});

describe('the boot line', () => {
  it('names the consequence when nothing is trusted', () => {
    expect(describeTrustProxy(false)).toMatch(/ONE rate-limit bucket/);
  });

  it('states the hop count when one is configured', () => {
    expect(describeTrustProxy(2)).toMatch(/2 hop/);
  });

  it('is printed at boot, so the setting is never silent', () => {
    const printed: string[] = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((...a) => {
      printed.push(a.join(' '));
    });
    const set = jest.fn();
    const app: any = { getHttpAdapter: () => ({ getInstance: () => ({ set }) }) };

    try {
      expect(applyTrustProxy(app, '2')).toBe(2);
    } finally {
      spy.mockRestore();
    }

    expect(set).toHaveBeenCalledWith('trust proxy', 2);
    expect(printed.join(' ')).toMatch(/TRUST_PROXY=2/);
  });
});
