import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { ProvidersService } from './providers.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiPaginationQuery } from '../common/swagger/api-pagination-query.decorator';

@ApiTags('Providers')
@Controller('providers')
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @ApiOperation({ summary: 'List providers' })
  @ApiPaginationQuery()
  @Public()
  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ) {
    return this.providersService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      q,
    });
  }

  @ApiOperation({ summary: 'Get one provider' })
  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.providersService.findOne(id);
  }
}
