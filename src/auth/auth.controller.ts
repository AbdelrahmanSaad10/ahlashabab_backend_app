import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { OtpRequestSchema, OtpRequestDto } from './dto/otp-request.dto';
import { OtpVerifySchema, OtpVerifyDto } from './dto/otp-verify.dto';
import { RefreshTokenSchema, RefreshTokenDto } from './dto/refresh-token.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Public } from '../common/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  async requestOtp(
    @Body(new ZodValidationPipe(OtpRequestSchema)) dto: OtpRequestDto,
  ) {
    return this.authService.requestOtp(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body(new ZodValidationPipe(OtpVerifySchema)) dto: OtpVerifyDto,
  ) {
    return this.authService.verifyOtp(dto.email, dto.code);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body(new ZodValidationPipe(RefreshTokenSchema)) dto: RefreshTokenDto,
  ) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body(new ZodValidationPipe(RefreshTokenSchema)) dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }
}
