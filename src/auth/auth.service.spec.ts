import 'reflect-metadata';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * The OTP and refresh flows decide who is signed in, so they carry the properties
 * that matter most in this codebase — and they had **no tests at all**.
 *
 * T-04 replaced the simulated mobile login with the real one, but its live proof
 * stops at "a wrong code is rejected", because OTP email delivery is unconfigured
 * (T-06). None of that is needed here: the decisions are made in this service,
 * against Prisma, so a mocked client exercises every branch with no database, no
 * SMTP and no token.
 *
 * These assert *security properties*, not line coverage:
 *   - a wrong / expired / exhausted code never yields tokens;
 *   - an OTP cannot be replayed after use;
 *   - a refresh token is single-use and a revoked one stays dead;
 *   - a disabled admin cannot refresh their way back in;
 *   - `Test@Example.COM` and `  test@example.com  ` are one account.
 */

const TOKENS = { accessToken: 'access.jwt', refreshToken: 'refresh.jwt' };

function build(overrides: Record<string, any> = {}) {
  const calls: Record<string, any[]> = {
    otpUpdate: [],
    otpUpdateMany: [],
    otpCreate: [],
    userCreate: [],
    refreshUpdate: [],
    sendOtp: [],
  };

  const prisma: any = {
    otpCode: {
      findFirst: overrides.otpFindFirst ?? (async () => null),
      update: async (a: any) => (calls.otpUpdate.push(a), a),
      updateMany: async (a: any) => (calls.otpUpdateMany.push(a), a),
      create: async (a: any) => (calls.otpCreate.push(a), a),
    },
    user: {
      findUnique: overrides.userFindUnique ?? (async () => ({ id: 'u1', email: 'test@example.com', name: null })),
      create: async (a: any) => (calls.userCreate.push(a), { id: 'u-new', ...a.data }),
    },
    adminUser: { findUnique: overrides.adminFindUnique ?? (async () => null) },
    refreshToken: {
      findUnique: overrides.refreshFindUnique ?? (async () => null),
      update: async (a: any) => (calls.refreshUpdate.push(a), a),
      create: async () => ({}),
      deleteMany: async () => ({}),
      updateMany: async () => ({}),
    },
  };

  const jwt: any = { signAsync: async () => 'access.jwt' };
  const config: any = { get: (k: string) => ({ OTP_TTL: '10m', JWT_ACCESS_TTL: '15m', JWT_REFRESH_TTL: '30d' } as any)[k] };
  const email: any = { sendOtp: async (...a: any[]) => calls.sendOtp.push(a) };

  const svc = new AuthService(prisma, jwt, config, email);
  // Token minting is JWT plumbing, not the decision under test; stub it so a
  // failure here can only mean the *decision* was wrong.
  (svc as any).generateTokens = async () => ({ ...TOKENS });
  return { svc, calls, prisma };
}

const future = () => new Date(Date.now() + 60_000);
const past = () => new Date(Date.now() - 60_000);

const otpRow = (o: Record<string, any> = {}) => ({
  id: 'otp1', email: 'test@example.com', code: '123456',
  used: false, attempts: 0, expiresAt: future(), createdAt: new Date(), ...o,
});

describe('AuthService — OTP verification', () => {
  it('issues tokens for the correct code', async () => {
    const { svc } = build({ otpFindFirst: async () => otpRow() });
    const res = await svc.verifyOtp('test@example.com', '123456');
    expect(res.accessToken).toBe(TOKENS.accessToken);
    expect(res.user.email).toBe('test@example.com');
  });

  it('rejects a wrong code and issues nothing', async () => {
    const { svc } = build({ otpFindFirst: async () => otpRow() });
    await expect(svc.verifyOtp('test@example.com', '999999')).rejects.toThrow(BadRequestException);
  });

  it('counts a wrong attempt WITHOUT consuming the code', async () => {
    // Consuming it on a typo would lock out a legitimate user; not counting it
    // would make brute force free. It must do exactly one of these.
    const { svc, calls } = build({ otpFindFirst: async () => otpRow() });
    await expect(svc.verifyOtp('test@example.com', '999999')).rejects.toThrow();
    expect(calls.otpUpdate).toHaveLength(1);
    expect(calls.otpUpdate[0].data).toEqual({ attempts: { increment: 1 } });
  });

  it('rejects an expired code and burns it, so it cannot be retried', async () => {
    const { svc, calls } = build({ otpFindFirst: async () => otpRow({ expiresAt: past() }) });
    await expect(svc.verifyOtp('test@example.com', '123456')).rejects.toThrow(BadRequestException);
    expect(calls.otpUpdate[0].data).toEqual({ used: true });
  });

  it('locks out after 5 attempts, even when the code is finally right', async () => {
    const { svc, calls } = build({ otpFindFirst: async () => otpRow({ attempts: 5 }) });
    await expect(svc.verifyOtp('test@example.com', '123456')).rejects.toThrow(BadRequestException);
    expect(calls.otpUpdate[0].data).toEqual({ used: true });
  });

  it('consumes the code on success — no replay', async () => {
    const { svc, calls } = build({ otpFindFirst: async () => otpRow() });
    await svc.verifyOtp('test@example.com', '123456');
    expect(calls.otpUpdate.some((c) => c.data?.used === true)).toBe(true);
  });

  it('rejects when no unused code exists for the address', async () => {
    const { svc } = build({ otpFindFirst: async () => null });
    await expect(svc.verifyOtp('test@example.com', '123456')).rejects.toThrow(BadRequestException);
  });

  it('creates the user on first successful sign-in', async () => {
    const { svc, calls } = build({
      otpFindFirst: async () => otpRow(),
      userFindUnique: async () => null,
    });
    const res = await svc.verifyOtp('test@example.com', '123456');
    expect(calls.userCreate).toHaveLength(1);
    expect(res.user.email).toBe('test@example.com');
  });
});

describe('AuthService — email normalization (matrix row 16)', () => {
  const variants = ['Test@Example.COM', '  test@example.com  ', 'TEST@EXAMPLE.com'];

  it('treats case and whitespace variants as ONE account on verify', async () => {
    for (const v of variants) {
      const seen: string[] = [];
      const { svc } = build({
        otpFindFirst: async (a: any) => (seen.push(a.where.email), otpRow()),
        userFindUnique: async (a: any) => (seen.push(a.where.email), { id: 'u1', email: 'test@example.com', name: null }),
      });
      await svc.verifyOtp(v, '123456');
      expect(seen).toEqual(['test@example.com', 'test@example.com']);
    }
  });

  it('stores and sends the OTP against the normalized address', async () => {
    const { svc, calls } = build();
    await svc.requestOtp('  Test@Example.COM ');
    expect(calls.otpCreate[0].data.email).toBe('test@example.com');
    expect(calls.sendOtp[0][0]).toBe('test@example.com');
    // Previous unused codes for that address are invalidated first.
    expect(calls.otpUpdateMany[0].where).toEqual({ email: 'test@example.com', used: false });
  });

  it('issues a 6-digit numeric code', async () => {
    const { svc, calls } = build();
    await svc.requestOtp('test@example.com');
    expect(calls.otpCreate[0].data.code).toMatch(/^\d{6}$/);
  });
});

describe('AuthService — refresh tokens', () => {
  const stored = (o: Record<string, any> = {}) => ({
    id: 'rt1', token: 'refresh.jwt', revoked: false,
    expiresAt: future(), userId: 'u1', adminUserId: null, ...o,
  });

  it('rotates a valid token and revokes the old one — single use', async () => {
    const { svc, calls } = build({ refreshFindUnique: async () => stored() });
    const res = await svc.refreshTokens('refresh.jwt');
    expect(res.accessToken).toBe(TOKENS.accessToken);
    expect(calls.refreshUpdate[0].data).toEqual({ revoked: true });
  });

  it('refuses an already-revoked token — a stolen one stays dead', async () => {
    const { svc } = build({ refreshFindUnique: async () => stored({ revoked: true }) });
    await expect(svc.refreshTokens('refresh.jwt')).rejects.toThrow(UnauthorizedException);
  });

  it('refuses an expired token', async () => {
    const { svc } = build({ refreshFindUnique: async () => stored({ expiresAt: past() }) });
    await expect(svc.refreshTokens('refresh.jwt')).rejects.toThrow(UnauthorizedException);
  });

  it('refuses a token that does not exist', async () => {
    const { svc } = build({ refreshFindUnique: async () => null });
    await expect(svc.refreshTokens('made.up')).rejects.toThrow(UnauthorizedException);
  });

  it('refuses to refresh a DISABLED admin back into a session', async () => {
    const { svc } = build({
      refreshFindUnique: async () => stored({ userId: null, adminUserId: 'a1' }),
      adminFindUnique: async () => ({ id: 'a1', email: 'a@b.co', active: false, roleId: 'r1' }),
    });
    await expect(svc.refreshTokens('refresh.jwt')).rejects.toThrow(UnauthorizedException);
  });

  it('refuses when the admin record is gone entirely', async () => {
    const { svc } = build({
      refreshFindUnique: async () => stored({ userId: null, adminUserId: 'a1' }),
      adminFindUnique: async () => null,
    });
    await expect(svc.refreshTokens('refresh.jwt')).rejects.toThrow(UnauthorizedException);
  });
});
