import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { DonationsService } from './donations.service';
import { ApiBody, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';

interface PaymentWebhookBody {
  gatewayTxId: string;
  amount: number;
  status: string;
}

@ApiTags('Webhooks')
@Controller('webhooks')
export class DonationsWebhookController {
  constructor(private readonly donationsService: DonationsService) {}

  @ApiOperation({
    summary: 'Payment gateway callback',
    description:
      'Called by the payment provider, not by clients. Marks the matching donation paid or failed. '
      + 'NOTE: this endpoint is `@Public()` and does not verify a signature — see BACKEND.md before going live.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['gatewayTxId', 'amount', 'status'],
      properties: {
        gatewayTxId: { type: 'string', description: 'Provider transaction id' },
        amount: { type: 'number' },
        status: { type: 'string' },
      },
    },
  })
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
