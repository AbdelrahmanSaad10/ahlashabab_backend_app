import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/decorators/public.decorator';
import { DonationsService } from './donations.service';
import { createHmac } from 'crypto';

interface PaymentWebhookBody {
  gatewayTxId: string;
  amount: number;
  status: string;
}

@Controller('webhooks')
export class DonationsWebhookController {
  constructor(
    private readonly donationsService: DonationsService,
    private readonly config: ConfigService,
  ) {}

  @Post('payment')
  @Public()
  handlePayment(
    @Body() body: PaymentWebhookBody,
    @Headers('x-webhook-signature') signature?: string,
  ) {
    const secret = this.config.get<string>('WEBHOOK_SECRET');
    if (secret) {
      if (!signature) {
        throw new UnauthorizedException('Missing webhook signature');
      }
      const expected = createHmac('sha256', secret)
        .update(JSON.stringify(body))
        .digest('hex');
      if (signature !== expected) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }
    return this.donationsService.handleWebhook(
      body.gatewayTxId,
      body.amount,
      body.status,
    );
  }
}
