import { Body, Controller, Post, UsePipes } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ConsultationsService } from './consultations.service';
import {
  CreateConsultationDto,
  CreateConsultationSchema,
} from './dto/create-consultation.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiZodBody } from '../common/swagger/api-zod-body.decorator';

@ApiTags('Consultations')
@Controller('consultations')
export class ConsultationsController {
  constructor(private readonly consultationsService: ConsultationsService) {}

  @ApiOperation({
    summary: 'Submit a consultation request',
    description:
      'Public intake. The `type` must match a consultation type key from GET /cms '
      + '(the app uses Arabic keys). Unknown per-type answers go in `extraFields`. '
      + 'Rate limited to 3 requests per minute per IP.',
  })
  @ApiZodBody(CreateConsultationSchema)
  @Public()
  @Post()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UsePipes(new ZodValidationPipe(CreateConsultationSchema))
  create(@Body() dto: CreateConsultationDto) {
    return this.consultationsService.create(dto);
  }
}
