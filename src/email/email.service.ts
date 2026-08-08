import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    const provider = config.get<string>('EMAIL_PROVIDER') ?? 'smtp';

    if (provider === 'smtp') {
      this.transporter = nodemailer.createTransport({
        host: config.get<string>('SMTP_HOST') ?? 'localhost',
        port: config.get<number>('SMTP_PORT') ?? 1025,
        auth: config.get<string>('SMTP_USER')
          ? {
              user: config.get<string>('SMTP_USER'),
              pass: config.get<string>('SMTP_PASS'),
            }
          : undefined,
      });
    } else {
      // For SES/SendGrid, configure SMTP relay or use their SDKs
      this.transporter = nodemailer.createTransport({
        host: config.get<string>('SMTP_HOST'),
        port: config.get<number>('SMTP_PORT') ?? 587,
        secure: true,
        auth: {
          user: config.get<string>('SMTP_USER') ?? '',
          pass: config.get<string>('EMAIL_PROVIDER_KEY') ?? '',
        },
      });
    }
  }

  async sendOtp(to: string, code: string): Promise<void> {
    const from = this.config.get<string>('EMAIL_FROM') ?? 'no-reply@ahlashabab.com';

    try {
      await this.transporter.sendMail({
        from,
        to,
        subject: 'رمز التحقق - أحلى شباب',
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>رمز التحقق الخاص بك</h2>
            <p>استخدم الرمز التالي لتسجيل الدخول:</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 20px; background: #f5f5f5; border-radius: 8px; text-align: center; margin: 20px 0;">
              ${code}
            </div>
            <p>هذا الرمز صالح لمدة 10 دقائق.</p>
            <p style="color: #888; font-size: 12px;">إذا لم تطلب هذا الرمز، يمكنك تجاهل هذه الرسالة.</p>
          </div>
        `,
      });
      this.logger.log(`OTP sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send OTP to ${to}:`, error);

      /*
       * Outside production the log IS the delivery channel: no SMTP is
       * configured on a developer's machine, and printing the code is what makes
       * the real login flow usable locally. The gate was `=== 'development'`,
       * which meant a staging or test environment — the two places QA actually
       * works — logged nothing and had no way in at all.
       */
      if (this.config.get<string>('NODE_ENV') !== 'production') {
        this.logger.warn(`[DEV] OTP for ${to}: ${code}`);
        return;
      }

      /*
       * In production, do NOT pretend it was sent.
       *
       * This catch used to swallow everything, so `POST /auth/otp/request`
       * answered 200 with «تم إرسال رمز التحقق إلى بريدك الإلكتروني» whether or
       * not a single byte left the server. With no SMTP credentials configured
       * that is every request: the app told the user to check their inbox, and
       * nothing was ever coming. A user could not log in and could not find out
       * why, and neither could anyone reading the API.
       *
       * The 503 does not leak whether the address exists — it depends only on
       * the mail transport — so the anti-enumeration property of this endpoint
       * is unaffected.
       */
      throw new ServiceUnavailableException(
        'تعذّر إرسال رمز التحقق حالياً. برجاء المحاولة مرة أخرى لاحقاً.',
      );
    }
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    const from = this.config.get<string>('EMAIL_FROM') ?? 'no-reply@ahlashabab.com';

    try {
      await this.transporter.sendMail({ from, to, subject, html });
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
    }
  }
}
