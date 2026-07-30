import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AdminLoginSchema, AdminLoginDto } from './dto/admin-login.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Public } from '../common/decorators/public.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiZodBody } from '../common/swagger/api-zod-body.decorator';

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
}
