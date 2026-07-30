import { Body, Controller, Post, UsePipes } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ConsultationsService } from './consultations.service';
import {
  CreateConsultationDto,
  CreateConsultationSchema,
} from './dto/create-consultation.dto';

@Controller('consultations')
export class ConsultationsController {
  constructor(private readonly consultationsService: ConsultationsService) {}

  @Public()
  @Post()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UsePipes(new ZodValidationPipe(CreateConsultationSchema))
  create(@Body() dto: CreateConsultationDto) {
    return this.consultationsService.create(dto);
  }
}
