import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly uploadDir: string;

  constructor(private readonly config: ConfigService) {
    this.uploadDir = this.config.get<string>('UPLOAD_DIR') ?? 'uploads';

    // Ensure the upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  getUploadDir(): string {
    return this.uploadDir;
  }

  async uploadFile(
    file: Express.Multer.File,
  ): Promise<{ url: string; filename: string; size: number }> {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${uuidv4()}${ext}`;
    const filePath = path.join(this.uploadDir, filename);

    fs.writeFileSync(filePath, file.buffer);

    this.logger.log(`File uploaded: ${filename} (${file.size} bytes)`);

    return {
      url: `/uploads/${filename}`,
      filename,
      size: file.size,
    };
  }

  async uploadImage(
    file: Express.Multer.File,
  ): Promise<{ url: string; filename: string; size: number }> {
    // Validate that the file is an image
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ];

    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_FILE_TYPE',
          message: 'نوع الملف غير مدعوم. يجب أن يكون صورة (JPEG, PNG, GIF, WebP)',
        },
      });
    }

    // For SVGs, skip sharp processing
    if (file.mimetype === 'image/svg+xml') {
      return this.uploadFile(file);
    }

    const filename = `${uuidv4()}.jpg`;
    const filePath = path.join(this.uploadDir, filename);

    // Process with sharp: strip EXIF, resize max 1280px, JPEG 80%
    const processedBuffer = await sharp(file.buffer)
      .rotate() // Auto-rotate based on EXIF orientation before stripping
      .resize(1280, 1280, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    fs.writeFileSync(filePath, processedBuffer);

    this.logger.log(
      `Image uploaded: ${filename} (${file.size} -> ${processedBuffer.length} bytes)`,
    );

    return {
      url: `/uploads/${filename}`,
      filename,
      size: processedBuffer.length,
    };
  }

  deleteFile(filename: string): void {
    const filePath = path.join(this.uploadDir, filename);

    if (!fs.existsSync(filePath)) {
      throw new BadRequestException({
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'الملف غير موجود',
        },
      });
    }

    fs.unlinkSync(filePath);
    this.logger.log(`File deleted: ${filename}`);
  }
}
