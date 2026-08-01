import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { OptionalAuth } from '../common/decorators/optional-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { DonationsService } from './donations.service';
import {
  CreateDonationDto,
  CreateDonationSchema,
} from './dto/create-donation.dto';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiZodBody } from '../common/swagger/api-zod-body.decorator';

@ApiTags('Donations')
@Controller('donations')
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  @ApiOperation({
    summary: 'Create a donation',
    description:
      'Auth is optional — send a bearer token to attach the donation to the account, or omit it to donate as a guest. '
      + 'Never returns a successful donation: manual methods start at `قيد المراجعة` (awaiting admin approval) and '
      + 'gateway methods at `قيد التأكيد` (awaiting the webhook). Rate limited to 5 per minute per IP.',
  })
  @ApiBearerAuth('access-token')
  @ApiZodBody(CreateDonationSchema)
  @Post()
  @OptionalAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  create(
    @Body(new ZodValidationPipe(CreateDonationSchema)) dto: CreateDonationDto,
    @CurrentUser() user?: { id: string },
  ) {
    return this.donationsService.create(dto, user?.id);
  }

  @ApiOperation({ summary: 'Look up a donation by reference', description: 'Public — the reference is the receipt the donor was shown.' })
  @ApiParam({ name: 'reference', description: 'Donation reference issued at creation' })
  @Get(':reference')
  @Public()
  findByReference(@Param('reference') reference: string) {
    return this.donationsService.findByReference(reference);
  }
}
