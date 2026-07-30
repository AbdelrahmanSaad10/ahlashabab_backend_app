import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UsePipes,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { UsersService } from './users.service';
import {
  UpdateProfileDto,
  UpdateProfileSchema,
} from './dto/update-profile.dto';
import {
  CreateFavoriteDto,
  CreateFavoriteSchema,
} from './dto/create-favorite.dto';
import {
  RegisterDeviceDto,
  RegisterDeviceSchema,
} from './dto/register-device.dto';

@Controller('me')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getProfile(@CurrentUser() user: any) {
    return this.usersService.findById(user.sub);
  }

  @Patch()
  @UsePipes(new ZodValidationPipe(UpdateProfileSchema))
  updateProfile(
    @CurrentUser() user: any,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @Get('bookings')
  getBookings(@CurrentUser() user: any) {
    return this.usersService.getUserBookings(user.sub);
  }

  @Get('donations')
  async getDonations(@CurrentUser() user: any) {
    const donations = await this.usersService.getUserDonations(user.sub);
    const total = donations.reduce((sum, d) => sum + d.amount, 0);

    return {
      data: donations,
      total,
    };
  }

  @Get('consultations')
  getConsultations(@CurrentUser() user: any) {
    return this.usersService.getUserConsultations(user.sub);
  }

  @Get('favorites')
  getFavorites(@CurrentUser() user: any) {
    return this.usersService.getFavorites(user.sub);
  }

  @Post('favorites')
  addFavorite(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(CreateFavoriteSchema)) dto: CreateFavoriteDto,
  ) {
    return this.usersService.addFavorite(user.sub, dto.entityType, dto.entityId);
  }

  @Delete('favorites')
  removeFavorite(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(CreateFavoriteSchema)) dto: CreateFavoriteDto,
  ) {
    return this.usersService.removeFavorite(
      user.sub,
      dto.entityType,
      dto.entityId,
    );
  }

  @Post('device-tokens')
  registerDevice(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(RegisterDeviceSchema)) dto: RegisterDeviceDto,
  ) {
    return this.usersService.registerDeviceToken(
      user.sub,
      dto.token,
      dto.platform,
    );
  }
}
