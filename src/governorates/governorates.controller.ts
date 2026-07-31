import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { GovernoratesService } from './governorates.service';

@Controller('governorates')
export class GovernoratesController {
  constructor(private readonly governoratesService: GovernoratesService) {}

  @Public()
  @Get()
  findAll() {
    return this.governoratesService.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.governoratesService.findOne(+id);
  }
}
