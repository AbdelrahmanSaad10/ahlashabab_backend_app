import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { DonationsService } from './donations.service';

interface PaymentWebhookBody {
  gatewayTxId: string;
  amount: number;
  status: string;
}

@Controller('webhooks')
export class DonationsWebhookController {
  constructor(private readonly donationsService: DonationsService) {}

  @Post('payment')
  @Public()
  handlePayment(@Body() body: PaymentWebhookBody) {
    return this.donationsService.handleWebhook(
      body.gatewayTxId,
      body.amount,
      body.status,
    );
  }
}
