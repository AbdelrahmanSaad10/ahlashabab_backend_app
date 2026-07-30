import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { OtpRequestSchema, OtpRequestDto } from './dto/otp-request.dto';
import { OtpVerifySchema, OtpVerifyDto } from './dto/otp-verify.dto';
import { RefreshTokenSchema, RefreshTokenDto } from './dto/refresh-token.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Public } from '../common/decorators/public.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiZodBody } from '../common/swagger/api-zod-body.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'Request a login OTP by email',
    description: 'Sends a one-time code. Always answers 200 whether or not the address exists, so it cannot be used to enumerate accounts. Rate limited to 5 per 10 minutes.',
  })
  @ApiZodBody(OtpRequestSchema)
  @Public()
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  async requestOtp(
    @Body(new ZodValidationPipe(OtpRequestSchema)) dto: OtpRequestDto,
  ) {
    return this.authService.requestOtp(dto.email);
  }

  @ApiOperation({
    summary: 'Exchange an OTP for tokens',
    description: 'Returns an access token and a refresh token. Rate limited to 10 per 10 minutes.',
  })
  @ApiZodBody(OtpVerifySchema)
  @Public()
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body(new ZodValidationPipe(OtpVerifySchema)) dto: OtpVerifyDto,
  ) {
    return this.authService.verifyOtp(dto.email, dto.code);
  }

  @ApiOperation({
    summary: 'Rotate an access token',
    description: 'Public because the refresh token in the body *is* the credential — read from the body, not the Authorization header.',
  })
  @ApiZodBody(RefreshTokenSchema)
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body(new ZodValidationPipe(RefreshTokenSchema)) dto: RefreshTokenDto,
  ) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @ApiOperation({ summary: 'Revoke a refresh token' })
  @ApiBearerAuth('access-token')
  @ApiZodBody(RefreshTokenSchema)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body(new ZodValidationPipe(RefreshTokenSchema)) dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }
}
