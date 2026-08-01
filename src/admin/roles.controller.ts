import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { RolesService } from './roles.service';
import { CreateRoleDto, CreateRoleSchema } from './dto/create-role.dto';
import { UpdateRoleDto, UpdateRoleSchema } from './dto/update-role.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiZodBody } from '../common/swagger/api-zod-body.decorator';

@ApiTags('Roles')
@ApiBearerAuth('access-token')
@Controller('admin/roles')
@UseInterceptors(ActivityLogInterceptor)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @ApiOperation({ summary: 'List roles', description: 'Includes how many admin users hold each role. Requires roles:read.' })
  @Get()
  @RequirePermission('roles', 'read')
  findAll() {
    return this.rolesService.findAll();
  }

  @ApiOperation({ summary: 'Create a role', description: '`permissionsJson` maps a module to its allowed actions — this is what RolesGuard checks. Requires roles:write.' })
  @ApiZodBody(CreateRoleSchema)
  @Post()
  @RequirePermission('roles', 'write')
  create(
    @Body(new ZodValidationPipe(CreateRoleSchema)) dto: CreateRoleDto,
  ) {
    return this.rolesService.create(dto);
  }

  @ApiOperation({ summary: 'Update a role', description: 'Requires roles:write.' })
  @ApiZodBody(UpdateRoleSchema)
  @Patch(':id')
  @RequirePermission('roles', 'write')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateRoleSchema)) dto: UpdateRoleDto,
  ) {
    return this.rolesService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a role', description: 'Refused while any admin user still holds it. Requires roles:write.' })
  @Delete(':id')
  @RequirePermission('roles', 'write')
  remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }
}
