import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiZodBody } from '../common/swagger/api-zod-body.decorator';

@ApiTags('Me')
@ApiBearerAuth('access-token')
@Controller('me')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Get the signed-in profile' })
  @Get()
  getProfile(@CurrentUser() user: any) {
    return this.usersService.findById(user.sub);
  }

  @ApiOperation({ summary: 'Update the signed-in profile' })
  @ApiZodBody(UpdateProfileSchema)
  @Patch()
  updateProfile(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(UpdateProfileSchema)) dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @ApiOperation({ summary: "List the signed-in user's bookings" })
  @Get('bookings')
  getBookings(@CurrentUser() user: any) {
    return this.usersService.getUserBookings(user.sub);
  }

  @ApiOperation({ summary: "List the signed-in user's donations", description: 'Adds a `total` alongside `data` — the sum of the listed donation amounts.' })
  @Get('donations')
  async getDonations(@CurrentUser() user: any) {
    const donations = await this.usersService.getUserDonations(user.sub);
    const total = donations.reduce((sum, d) => sum + d.amount, 0);

    return {
      data: donations,
      total,
    };
  }

  @ApiOperation({ summary: "List the signed-in user's consultation requests" })
  @Get('consultations')
  getConsultations(@CurrentUser() user: any) {
    return this.usersService.getUserConsultations(user.sub);
  }

  @ApiOperation({ summary: 'List favorites' })
  @Get('favorites')
  getFavorites(@CurrentUser() user: any) {
    return this.usersService.getFavorites(user.sub);
  }

  @ApiOperation({ summary: 'Add a favorite' })
  @ApiZodBody(CreateFavoriteSchema)
  @Post('favorites')
  addFavorite(
    @CurrentUser() user: any,
    @Body(new ZodValidationPipe(CreateFavoriteSchema)) dto: CreateFavoriteDto,
  ) {
    return this.usersService.addFavorite(user.sub, dto.entityType, dto.entityId);
  }

  @ApiOperation({ summary: 'Remove a favorite', description: 'Identified by body, not by URL — send the same `entityType`/`entityId` used to add it. Note this DELETE takes a request body.' })
  @ApiZodBody(CreateFavoriteSchema)
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

  @ApiOperation({ summary: 'Register a push notification device token' })
  @ApiZodBody(RegisterDeviceSchema)
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
