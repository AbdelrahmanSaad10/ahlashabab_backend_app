import { Body, Controller, Post, UsePipes } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { VolunteersService } from './volunteers.service';
import {
  CreateVolunteerDto,
  CreateVolunteerSchema,
} from './dto/create-volunteer.dto';

@Controller('volunteers')
export class VolunteersController {
  constructor(private readonly volunteersService: VolunteersService) {}

  @Public()
  @Post()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UsePipes(new ZodValidationPipe(CreateVolunteerSchema))
  create(@Body() dto: CreateVolunteerDto) {
    return this.volunteersService.create(dto);
  }
}
