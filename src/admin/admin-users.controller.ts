import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminUsersService } from './admin-users.service';
import {
  CreateAdminUserDto,
  CreateAdminUserSchema,
  ResetAdminPasswordDto,
  ResetAdminPasswordSchema,
  UpdateAdminUserDto,
  UpdateAdminUserSchema,
} from './dto/admin-user.dto';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ApiZodBody } from '../common/swagger/api-zod-body.decorator';

/**
 * Administrator accounts — create, list, disable, reset a password.
 *
 * AUDITED-IN-SERVICE: this controller deliberately does **not** carry
 * `ActivityLogInterceptor`. The interceptor stores `newValue: request.body`, and
 * these bodies carry plaintext passwords, so wiring it here would write them into
 * the activity log. `AdminUsersService` writes the entries itself, with the
 * password fields stripped. The structural guard in
 * `test/integration/audit-log.int-spec.ts` recognises this marker and checks the
 * service audits instead.
 *
 * Guarded by `roles:write`, the same permission as the role editor: managing who
 * holds a role and managing the roles themselves are the same job, and only
 * «مدير عام» has it by default.
 *
 * There is no DELETE. An administrator who has done anything is referenced by the
 * activity log, and an audit trail that can be erased by deleting its subject is
 * not an audit trail. Use `PATCH :id { "active": false }` — the account keeps its
 * history and can no longer sign in.
 */
@ApiTags('Admin')
@ApiBearerAuth('access-token')
@Controller('admin/admin-users')
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  private context(req: { ip?: string; headers: Record<string, unknown> }) {
    return { ip: req.ip, userAgent: req.headers['user-agent'] as string | undefined };
  }

  @ApiOperation({
    summary: 'List administrator accounts',
    description: 'Never includes password hashes. Requires roles:write.',
  })
  @Get()
  @RequirePermission('roles', 'write')
  findAll() {
    return this.adminUsers.findAll();
  }

  @ApiOperation({ summary: 'Get one administrator account', description: 'Requires roles:write.' })
  @Get(':id')
  @RequirePermission('roles', 'write')
  findOne(@Param('id') id: string) {
    return this.adminUsers.findOne(id);
  }

  @ApiOperation({
    summary: 'Create an administrator account',
    description:
      'The password is hashed with argon2 and never stored, returned or logged. '
      + 'Optionally binds the account to a service provider, which is what /me/provider reads. '
      + 'Requires roles:write.',
  })
  @ApiZodBody(CreateAdminUserSchema)
  @Post()
  @RequirePermission('roles', 'write')
  create(
    @CurrentAdmin() admin: { id: string },
    @Body(new ZodValidationPipe(CreateAdminUserSchema)) dto: CreateAdminUserDto,
    @Req() req: { ip?: string; headers: Record<string, unknown> },
  ) {
    return this.adminUsers.create(dto, admin.id, this.context(req));
  }

  @ApiOperation({
    summary: 'Update an administrator account',
    description:
      'Name, role, provider binding, and active. Refused if it would deactivate your own account, '
      + 'or leave nobody holding roles:write. The email cannot be changed — it is the login '
      + 'identity. Requires roles:write.',
  })
  @ApiZodBody(UpdateAdminUserSchema)
  @Patch(':id')
  @RequirePermission('roles', 'write')
  update(
    @Param('id') id: string,
    @CurrentAdmin() admin: { id: string },
    @Body(new ZodValidationPipe(UpdateAdminUserSchema)) dto: UpdateAdminUserDto,
    @Req() req: { ip?: string; headers: Record<string, unknown> },
  ) {
    return this.adminUsers.update(id, dto, admin.id, this.context(req));
  }

  @ApiOperation({
    summary: "Reset another administrator's password",
    description:
      'Revokes every refresh token for that account, so sessions opened with the old password end '
      + 'immediately. Changing your own password is POST /admin/auth/change-password, which requires '
      + 'the current one. Requires roles:write.',
  })
  @ApiZodBody(ResetAdminPasswordSchema)
  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('roles', 'write')
  resetPassword(
    @Param('id') id: string,
    @CurrentAdmin() admin: { id: string },
    @Body(new ZodValidationPipe(ResetAdminPasswordSchema)) dto: ResetAdminPasswordDto,
    @Req() req: { ip?: string; headers: Record<string, unknown> },
  ) {
    return this.adminUsers.resetPassword(id, dto.newPassword, admin.id, this.context(req));
  }
}
