import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { ServicesService } from './services.service';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiPaginationQuery } from '../common/swagger/api-pagination-query.decorator';

@ApiTags('Services')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @ApiOperation({ summary: 'List services' })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiPaginationQuery()
  @Public()
  @Get()
  findAll(
    @Query('categoryId') categoryId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ) {
    return this.servicesService.findAll({
      categoryId,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      q,
    });
  }

  @ApiOperation({ summary: 'Get one service' })
  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.servicesService.findOne(id);
  }

  @ApiOperation({
    summary: "Get a service's booking form fields",
    description: 'The booking form is data-driven — render whatever this returns rather than hard-coding fields.',
  })
  @Public()
  @Get(':id/form')
  getFormFields(@Param('id') id: string) {
    return this.servicesService.getFormFields(id);
  }
}
