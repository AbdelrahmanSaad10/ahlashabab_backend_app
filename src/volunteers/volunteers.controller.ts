import { Body, Controller, Post, UsePipes } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { VolunteersService } from './volunteers.service';
import {
  CreateVolunteerDto,
  CreateVolunteerSchema,
} from './dto/create-volunteer.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiZodBody } from '../common/swagger/api-zod-body.decorator';

@ApiTags('Volunteers')
@Controller('volunteers')
export class VolunteersController {
  constructor(private readonly volunteersService: VolunteersService) {}

  @ApiOperation({ summary: 'Submit a volunteer application', description: 'Public. Rate limited to 3 requests per minute per IP.' })
  @ApiZodBody(CreateVolunteerSchema)
  @Public()
  @Post()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UsePipes(new ZodValidationPipe(CreateVolunteerSchema))
  create(@Body() dto: CreateVolunteerDto) {
    return this.volunteersService.create(dto);
  }
}
