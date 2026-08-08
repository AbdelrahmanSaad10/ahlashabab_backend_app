import 'reflect-metadata';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { EmailService } from '../src/email/email.service';

/**
 * What happens when the OTP email cannot be sent — T-06.
 *
 * `sendOtp` caught every error and returned normally, so
 * `POST /auth/otp/request` answered **200** with «تم إرسال رمز التحقق إلى بريدك
 * الإلكتروني» whether or not anything left the server. With no SMTP credentials
 * configured — the state the project has been in throughout — that was every
 * request: the app told the user to check an inbox nothing was coming to, and
 * no error surfaced anywhere a client could see.
 *
 * That is why "OTP delivery is blocked on SMTP" stayed a paragraph in a document
 * instead of a visible failure.
 *
 * The dev fallback that printed the code was gated on `NODE_ENV === 'development'`,
 * so staging and test — the two environments QA actually uses — logged nothing
 * and had no way in at all.
 */

const config = (env: string) =>
  ({
    get: (key: string) =>
      ({
        NODE_ENV: env,
        EMAIL_PROVIDER: 'smtp',
        EMAIL_FROM: 'no-reply@ahlashabab.com',
        SMTP_HOST: '127.0.0.1',
        SMTP_PORT: 1025,
      } as Record<string, unknown>)[key],
  } as any);

function serviceWith(env: string, sendMail: () => Promise<unknown>) {
  const svc = new EmailService(config(env));
  (svc as any).transporter = { sendMail };
  return svc;
}

describe('a failed OTP send in production', () => {
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  const failing = () => Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:1025'));

  it('is reported, not swallowed', async () => {
    const svc = serviceWith('production', failing);
    await expect(svc.sendOtp('donor@example.com', '123456')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('tells the user in Arabic that the code could not be sent', async () => {
    const svc = serviceWith('production', failing);
    await expect(svc.sendOtp('donor@example.com', '123456')).rejects.toThrow(/تعذّر إرسال رمز التحقق/);
  });

  it('never prints the code to a production log', async () => {
    const svc = serviceWith('production', failing);
    await svc.sendOtp('donor@example.com', '123456').catch(() => undefined);

    const logged = [...warn.mock.calls, ...error.mock.calls].flat().join(' ');
    expect(logged).not.toContain('123456');
  });
});

describe('a failed OTP send outside production', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  const failing = () => Promise.reject(new Error('no mail server here'));

  it.each(['development', 'test', 'staging'])(
    'prints the code so login still works (NODE_ENV=%s)',
    async (env) => {
      const svc = serviceWith(env, failing);
      await expect(svc.sendOtp('qa@example.com', '654321')).resolves.toBeUndefined();
      expect(warn.mock.calls.flat().join(' ')).toContain('654321');
    },
  );
});

describe('a successful send', () => {
  afterEach(() => jest.restoreAllMocks());

  it('resolves and does not print the code anywhere', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const sent: any[] = [];
    const svc = serviceWith('production', async (...args: any[]) => {
      sent.push(args[0]);
      return {};
    });

    await expect(svc.sendOtp('donor@example.com', '111222')).resolves.toBeUndefined();
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('donor@example.com');
    expect(sent[0].html).toContain('111222');
    expect(warn).not.toHaveBeenCalled();
  });
});
