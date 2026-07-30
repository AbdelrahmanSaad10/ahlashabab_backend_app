import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { NotificationsService } from './notifications.service';
import { PreferencesService } from './preferences.service';
import {
  UpdatePreferencesDto,
  UpdatePreferencesSchema,
} from './dto/update-preferences.dto';

@Controller('me')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly preferencesService: PreferencesService,
  ) {}

  @Get('notifications')
  getNotifications(
    @CurrentUser() user: { id: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.getUserNotifications(
      user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Patch('notifications/:id/read')
  markRead(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.notificationsService.markRead(user.id, id);
  }

  @Post('notifications/read-all')
  markAllRead(@CurrentUser() user: { id: string }) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Get('notification-preferences')
  getPreferences(@CurrentUser() user: { id: string }) {
    return this.preferencesService.getPreferences(user.id);
  }

  @Put('notification-preferences')
  updatePreferences(
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(UpdatePreferencesSchema))
    dto: UpdatePreferencesDto,
  ) {
    return this.preferencesService.updatePreferences(user.id, dto);
  }
}
