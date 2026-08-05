import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @ApiOperation({ summary: 'Health check', description: 'Simple test endpoint' })
  @Public()
  @Get()
  check() {
    return { message: 'اهلا احلي شباب' };
  }
}
