import {
  Body,
  Controller,
  Post,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { NotificationsService } from './notifications.service';
import { BroadcastDto, BroadcastSchema } from './dto/broadcast.dto';

@Controller('admin/notifications')
@UseInterceptors(ActivityLogInterceptor)
export class NotificationsAdminController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('broadcast')
  @RequirePermission('users', 'write')
  @UsePipes(new ZodValidationPipe(BroadcastSchema))
  broadcast(@Body() dto: BroadcastDto) {
    return this.notificationsService.broadcastToSegment(dto);
  }
}
