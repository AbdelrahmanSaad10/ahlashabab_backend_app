import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UsePipes,
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

@Controller('donations')
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  @Post()
  @OptionalAuth()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UsePipes(new ZodValidationPipe(CreateDonationSchema))
  create(
    @Body() dto: CreateDonationDto,
    @CurrentUser() user?: { id: string },
  ) {
    return this.donationsService.create(dto, user?.id);
  }

  @Get(':reference')
  @Public()
  findByReference(@Param('reference') reference: string) {
    return this.donationsService.findByReference(reference);
  }
}
