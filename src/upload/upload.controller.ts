import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { UploadService } from './upload.service';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * Uploads were not audited.
 *
 * This is an `admin/` route that writes a file to disk, and no record was kept of
 * who uploaded it. For this client the files are photographs of beneficiaries and
 * their documents — the images the portfolio editor labels "privacy-vetted" — so
 * "who put this here, and when" is exactly the question the log exists to answer.
 *
 * It went unnoticed because the audit guard matched controllers by *filename*
 * (`*-admin.controller.ts`); this one is `upload.controller.ts` serving
 * `admin/uploads`. The guard now selects by route.
 *
 * Safe to intercept: the body is multipart, so `request.body` holds no secret —
 * the file itself arrives through Multer, not through the JSON body the
 * interceptor records.
 */
@ApiTags('Uploads')
@ApiBearerAuth('access-token')
@Controller('admin/uploads')
@UseInterceptors(ActivityLogInterceptor)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @ApiOperation({ summary: 'Upload a file', description: 'Multipart. Requires portfolio:write.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
  @Post()
  @RequirePermission('portfolio', 'write')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB
      },
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException({
        error: {
          code: 'NO_FILE',
          message: 'لم يتم رفع أي ملف',
        },
      });
    }

    // Determine if the file is an image and process accordingly
    const imageMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ];

    if (imageMimes.includes(file.mimetype)) {
      return this.uploadService.uploadImage(file);
    }

    return this.uploadService.uploadFile(file);
  }
}
