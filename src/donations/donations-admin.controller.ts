import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { DonationsService } from './donations.service';
import {
  DonationFiltersDto,
  DonationFiltersSchema,
} from './dto/donation-filters.dto';
import { DonationStatus } from '../common/constants/statuses';
import { z } from 'zod';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiZodBody, ApiZodQuery } from '../common/swagger/api-zod-body.decorator';

const allStatuses = Object.values(DonationStatus) as [string, ...string[]];

const UpdateDonationStatusSchema = z.object({
  status: z.enum(allStatuses),
});

type UpdateDonationStatusDto = z.infer<typeof UpdateDonationStatusSchema>;

@ApiTags('Donations')
@ApiBearerAuth('access-token')
@Controller('admin/donations')
@UseInterceptors(ActivityLogInterceptor)
export class DonationsAdminController {
  constructor(private readonly donationsService: DonationsService) {}

  @ApiOperation({ summary: 'List donations', description: 'Paginated. Requires donations:read.' })
  @ApiZodQuery(DonationFiltersSchema)
  @Get()
  @RequirePermission('donations', 'read')
  findAll(
    @Query(new ZodValidationPipe(DonationFiltersSchema))
    filters: DonationFiltersDto,
  ) {
    return this.donationsService.findAll(filters);
  }

  @ApiOperation({
    summary: 'Update a donation status',
    description: 'This is the manual-approval path for bank transfers and wallets. The acting admin is recorded in the activity log. Requires donations:write.',
  })
  @ApiZodBody(UpdateDonationStatusSchema)
  @Patch(':id/status')
  @RequirePermission('donations', 'write')
  updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateDonationStatusSchema))
    dto: UpdateDonationStatusDto,
    @CurrentAdmin() admin: { id: string },
  ) {
    return this.donationsService.adminUpdateStatus(id, dto.status, admin.id);
  }
}
