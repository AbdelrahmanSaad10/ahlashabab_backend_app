import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class CmsMediaService {
  private readonly logger = new Logger(CmsMediaService.name);
  private readonly uploadDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const base = this.config.get<string>('UPLOAD_DIR', './uploads');
    this.uploadDir = path.join(base, 'cms');

    // Ensure the cms upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /** List all media items, optionally filtered by folder */
  async findAll(folder?: string) {
    const where: any = {};
    if (folder) {
      where.folder = folder;
    }

    return this.prisma.cmsMedia.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Upload a file and create a CmsMedia record */
  async upload(
    file: Express.Multer.File,
    metadata: { title?: string; alt?: string; caption?: string; folder?: string },
  ) {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
    const subfolder = metadata.folder ?? 'general';
    const destDir = path.join(this.uploadDir, subfolder);

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const destPath = path.join(destDir, filename);
    fs.writeFileSync(destPath, file.buffer);

    const publicBaseUrl = this.config.get<string>('PUBLIC_BASE_URL', 'http://localhost:4000');
    const srcUrl = `${publicBaseUrl}/uploads/cms/${subfolder}/${filename}`;

    const record = await this.prisma.cmsMedia.create({
      data: {
        title: metadata.title ?? file.originalname,
        alt: metadata.alt ?? null,
        caption: metadata.caption ?? null,
        folder: subfolder,
        srcUrl,
        type: file.mimetype,
        width: null,
        height: null,
        sizeBytes: file.size,
      },
    });

    return record;
  }

  /** Delete a media file and its record. Checks for references first. */
  async remove(id: string) {
    const media = await this.prisma.cmsMedia.findUnique({ where: { id } });

    if (!media) {
      throw new NotFoundException('ملف الوسائط غير موجود');
    }

    // Check if the media URL is referenced in CMS state
    const referenced = await this.isMediaReferenced(media.srcUrl);
    if (referenced) {
      throw new BadRequestException(
        'لا يمكن حذف هذا الملف لأنه مستخدم في محتوى CMS. قم بإزالة المرجع أولاً.',
      );
    }

    // Delete physical file
    try {
      const urlPath = new URL(media.srcUrl).pathname;
      // urlPath is like /uploads/cms/general/filename.jpg
      const relativePath = urlPath.replace(/^\/uploads\//, '');
      const base = this.config.get<string>('UPLOAD_DIR', './uploads');
      const filePath = path.join(base, relativePath);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      this.logger.warn(`Could not delete physical file for media ${id}: ${err}`);
    }

    // Delete database record
    await this.prisma.cmsMedia.delete({ where: { id } });

    return { message: 'تم حذف ملف الوسائط' };
  }

  /** Check if a media URL is referenced anywhere in the CMS state JSON columns */
  private async isMediaReferenced(srcUrl: string): Promise<boolean> {
    const row = await this.prisma.cmsState.findUnique({ where: { id: 1 } });
    if (!row) return false;

    const stateStr = JSON.stringify([
      row.settingsJson,
      row.menuJson,
      row.homeJson,
      row.pagesJson,
    ]);

    return stateStr.includes(srcUrl);
  }
}
