import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { GovernoratesService } from './governorates.service';

@ApiTags('Governorates')
@Controller('governorates')
export class GovernoratesController {
  constructor(private readonly governoratesService: GovernoratesService) {}

  @ApiOperation({ summary: 'List all 27 governorates', description: 'Returns id + name only — intended for picker dropdowns.' })
  @Public()
  @Get()
  findAll() {
    return this.governoratesService.findAll();
  }

  @ApiOperation({ summary: 'Get a single governorate' })
  @ApiParam({ name: 'id', type: Number })
  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.governoratesService.findOne(+id);
  }
}
