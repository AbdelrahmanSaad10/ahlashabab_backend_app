import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AdminLoginSchema, AdminLoginDto } from './dto/admin-login.dto';
import {
  AdminChangePasswordSchema,
  AdminChangePasswordDto,
} from './dto/admin-change-password.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Public } from '../common/decorators/public.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiZodBody } from '../common/swagger/api-zod-body.decorator';

/**
 * AUDITED-IN-SERVICE: no `ActivityLogInterceptor` here, deliberately. It stores
 * `newValue: request.body`, and these bodies are credentials — the current and
 * new password on a change, the login password on the way in. `AuthService`
 * writes the audit entry for a password change itself, with no body attached.
 */
@ApiTags('Auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'Dashboard login (email + password)',
    description:
      'Returns the bearer token every /admin route needs. Rate limited to 5 attempts per 10 minutes. '
      + 'Admin accounts authenticate with a password here; app users use the OTP flow under /auth instead.',
  })
  @ApiZodBody(AdminLoginSchema)
  @Public()
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(AdminLoginSchema)) dto: AdminLoginDto,
  ) {
    return this.authService.adminLogin(dto.email, dto.password);
  }

  @ApiOperation({
    summary: 'Change your own admin password',
    description:
      'Verifies the current password, then rotates it and revokes every refresh token for this '
      + 'account — so any session opened with the old password is ended immediately. Rate limited '
      + 'to 5 attempts per 10 minutes.',
  })
  @ApiBearerAuth('access-token')
  @ApiZodBody(AdminChangePasswordSchema)
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentAdmin() admin: { id: string },
    @Body(new ZodValidationPipe(AdminChangePasswordSchema)) dto: AdminChangePasswordDto,
    @Req() req: { ip?: string; headers: Record<string, unknown> },
  ) {
    return this.authService.changeAdminPassword(admin.id, dto.currentPassword, dto.newPassword, {
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
  }
}
