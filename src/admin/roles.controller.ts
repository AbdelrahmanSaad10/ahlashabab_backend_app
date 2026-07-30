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

@Controller('admin/roles')
@UseInterceptors(ActivityLogInterceptor)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermission('roles', 'read')
  findAll() {
    return this.rolesService.findAll();
  }

  @Post()
  @RequirePermission('roles', 'write')
  create(
    @Body(new ZodValidationPipe(CreateRoleSchema)) dto: CreateRoleDto,
  ) {
    return this.rolesService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('roles', 'write')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateRoleSchema)) dto: UpdateRoleDto,
  ) {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('roles', 'write')
  remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }
}
