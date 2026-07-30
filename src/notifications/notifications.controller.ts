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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiZodBody } from '../common/swagger/api-zod-body.decorator';

@ApiTags('Me')
@ApiBearerAuth('access-token')
@Controller('me')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly preferencesService: PreferencesService,
  ) {}

  @ApiOperation({ summary: 'List notifications' })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', default: 1 } })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', default: 20 } })
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

  @ApiOperation({ summary: 'Mark one notification read' })
  @Patch('notifications/:id/read')
  markRead(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.notificationsService.markRead(user.id, id);
  }

  @ApiOperation({ summary: 'Mark all notifications read' })
  @Post('notifications/read-all')
  markAllRead(@CurrentUser() user: { id: string }) {
    return this.notificationsService.markAllRead(user.id);
  }

  @ApiOperation({ summary: 'Get notification preferences' })
  @Get('notification-preferences')
  getPreferences(@CurrentUser() user: { id: string }) {
    return this.preferencesService.getPreferences(user.id);
  }

  @ApiOperation({ summary: 'Replace notification preferences', description: 'PUT semantics — send the whole preference set.' })
  @ApiZodBody(UpdatePreferencesSchema)
  @Put('notification-preferences')
  updatePreferences(
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(UpdatePreferencesSchema))
    dto: UpdatePreferencesDto,
  ) {
    return this.preferencesService.updatePreferences(user.id, dto);
  }
}
