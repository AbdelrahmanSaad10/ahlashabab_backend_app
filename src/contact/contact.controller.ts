import { Body, Controller, Post, UsePipes } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ContactService } from './contact.service';
import {
  CreateContactDto,
  CreateContactSchema,
} from './dto/create-contact.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiZodBody } from '../common/swagger/api-zod-body.decorator';

@ApiTags('Contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @ApiOperation({ summary: 'Send a contact message', description: 'Public. Rate limited to 3 requests per minute per IP.' })
  @ApiZodBody(CreateContactSchema)
  @Public()
  @Post()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UsePipes(new ZodValidationPipe(CreateContactSchema))
  create(@Body() dto: CreateContactDto) {
    return this.contactService.create(dto);
  }
}
