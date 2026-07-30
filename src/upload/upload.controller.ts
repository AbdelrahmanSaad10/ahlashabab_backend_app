import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RequirePermission } from '../common/decorators/permissions.decorator';
import { UploadService } from './upload.service';

@Controller('admin/uploads')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

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
