import {
  Body,
  Controller,
  Headers,
  Logger,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { Public } from '../common/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { DonationsService } from './donations.service';

export const PaymentWebhookSchema = z.object({
  gatewayTxId: z
    .string({ required_error: 'معرّف العملية مطلوب' })
    .min(1, 'معرّف العملية مطلوب'),
  amount: z.number({ required_error: 'المبلغ مطلوب' }),
  status: z
    .string({ required_error: 'حالة العملية مطلوبة' })
    .min(1, 'حالة العملية مطلوبة'),
});

export type PaymentWebhookDto = z.infer<typeof PaymentWebhookSchema>;

@Controller('webhooks')
export class DonationsWebhookController {
  private readonly logger = new Logger(DonationsWebhookController.name);

  constructor(
    private readonly donationsService: DonationsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Called by the payment provider, not by clients.
   *
   * The body is now validated, so a malformed payload is a 400 rather than the
   * 500 it used to raise inside handleWebhook.
   */
  @Post('payment')
  @Public()
  handlePayment(
    @Body(new ZodValidationPipe(PaymentWebhookSchema)) body: PaymentWebhookDto,
    @Headers('x-webhook-signature') signature?: string,
  ) {
    this.verifySignature(body, signature);
    return this.donationsService.handleWebhook(
      body.gatewayTxId,
      body.amount,
      body.status,
    );
  }

  /**
   * This endpoint can mark a donation paid, so it fails CLOSED.
   *
   * Verification previously ran only `if (secret)`, and WEBHOOK_SECRET is not set
   * in the deployed environment — which left the route effectively public while
   * looking protected. An unset secret is now a hard failure in production
   * instead of a silent bypass. Outside production it is allowed through with a
   * warning, so local work does not need a secret configured.
   */
  private verifySignature(body: PaymentWebhookDto, signature?: string): void {
    const secret = this.config.get<string>('WEBHOOK_SECRET');

    if (!secret) {
      if (this.config.get<string>('NODE_ENV') === 'production') {
        this.logger.error('WEBHOOK_SECRET is not configured — rejecting payment webhook');
        throw new ServiceUnavailableException('Webhook verification is not configured');
      }
      this.logger.warn(
        'WEBHOOK_SECRET is not set — skipping signature check. Non-production only.',
      );
      return;
    }

    if (!signature) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    const expected = createHmac('sha256', secret)
      .update(JSON.stringify(body))
      .digest('hex');

    // Constant-time compare. A plain `!==` returns as soon as two bytes differ,
    // which leaks how much of the signature was correct — enough to forge one a
    // byte at a time. timingSafeEqual throws on a length mismatch, so check that
    // first rather than letting it raise.
    const given = Buffer.from(signature, 'utf8');
    const want = Buffer.from(expected, 'utf8');
    if (given.length !== want.length || !timingSafeEqual(given, want)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }
}
