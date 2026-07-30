import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: {
    category?: string;
    published?: boolean;
    q?: string;
    page?: number;
    limit?: number;
  }) {
    const { category, published, q, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (category) {
      where.category = category;
    }

    if (published !== undefined) {
      where.published = published;
    }

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { excerpt: { contains: q, mode: 'insensitive' } },
        { body: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.article.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const article = await this.prisma.article.findUnique({
      where: { id },
    });

    if (!article) {
      throw new NotFoundException('المقال غير موجود');
    }

    return article;
  }

  async create(dto: CreateArticleDto) {
    return this.prisma.article.create({
      data: {
        category: dto.category,
        title: dto.title,
        excerpt: dto.excerpt,
        body: dto.body,
        date: new Date(dto.date),
        location: dto.location,
        readMinutes: dto.readMinutes,
        coverUrl: dto.coverUrl,
        published: dto.published ?? false,
      },
    });
  }

  async update(id: string, dto: UpdateArticleDto) {
    await this.findOne(id);

    const data: any = { ...dto };
    if (dto.date) {
      data.date = new Date(dto.date);
    }

    return this.prisma.article.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.article.delete({ where: { id } });
  }

  async togglePublish(id: string) {
    const article = await this.findOne(id);

    return this.prisma.article.update({
      where: { id },
      data: { published: !article.published },
    });
  }
}
