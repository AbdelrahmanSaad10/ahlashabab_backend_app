import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { PortfolioFiltersDto } from './dto/portfolio-filters.dto';

@Injectable()
export class PortfolioService {
  constructor(private readonly prisma: PrismaService) {}

  // ──────────────────────────────────────────────
  // CASES
  // ──────────────────────────────────────────────

  async findAllCases(filters: {
    tag?: string;
    published?: boolean;
    q?: string;
    page?: number;
    limit?: number;
  }) {
    const { tag, published, q, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (tag) {
      where.tag = tag;
    }

    if (published !== undefined) {
      where.published = published;
    }

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.case.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.case.count({ where }),
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

  async findCaseById(id: string) {
    const item = await this.prisma.case.findUnique({
      where: { id },
      include: { updates: { orderBy: { createdAt: 'desc' } } },
    });

    if (!item) {
      throw new NotFoundException('الحالة غير موجودة');
    }

    return item;
  }

  async createCase(dto: CreateCaseDto) {
    return this.prisma.case.create({
      data: {
        code: dto.code,
        title: dto.title,
        location: dto.location,
        summary: dto.summary,
        need: dto.need,
        tag: dto.tag,
        verified: dto.verified ?? false,
        targetAmount: dto.targetAmount,
        raisedAmount: dto.raisedAmount ?? 0,
        supporters: dto.supporters ?? 0,
        coverUrl: dto.coverUrl,
        sponsorable: dto.sponsorable ?? false,
        monthlyAmount: dto.monthlyAmount,
        sponsorshipDuration: dto.sponsorshipDuration,
        sponsorshipStatus: dto.sponsorshipStatus,
        published: dto.published ?? false,
      },
    });
  }

  async updateCase(id: string, dto: Partial<CreateCaseDto>) {
    await this.findCaseById(id);

    return this.prisma.case.update({
      where: { id },
      data: dto,
    });
  }

  async deleteCase(id: string) {
    await this.findCaseById(id);

    return this.prisma.case.delete({ where: { id } });
  }

  async addCaseUpdate(caseId: string, text: string, kind?: string) {
    await this.findCaseById(caseId);

    return this.prisma.caseUpdate.create({
      data: { caseId, text, kind },
    });
  }

  // ──────────────────────────────────────────────
  // PROJECTS
  // ──────────────────────────────────────────────

  async findAllProjects(filters: {
    published?: boolean;
    category?: string;
    q?: string;
    page?: number;
    limit?: number;
  }) {
    const { published, category, q, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (published !== undefined) {
      where.published = published;
    }

    if (category) {
      where.category = category;
    }

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        include: {
          stages: { orderBy: { sortOrder: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.project.count({ where }),
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

  async findProjectById(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        stages: { orderBy: { sortOrder: 'asc' } },
        updates: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!project) {
      throw new NotFoundException('المشروع غير موجود');
    }

    return project;
  }

  async createProject(dto: CreateProjectDto) {
    const { stages, ...projectData } = dto;

    return this.prisma.project.create({
      data: {
        ...projectData,
        stages: stages?.length
          ? {
              create: stages.map((s) => ({
                label: s.label,
                done: s.done ?? false,
                sortOrder: s.sortOrder ?? 0,
              })),
            }
          : undefined,
      },
      include: {
        stages: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async updateProject(id: string, dto: Partial<CreateProjectDto>) {
    await this.findProjectById(id);

    const { stages, ...projectData } = dto;

    return this.prisma.project.update({
      where: { id },
      data: projectData,
      include: {
        stages: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async deleteProject(id: string) {
    await this.findProjectById(id);

    return this.prisma.project.delete({ where: { id } });
  }

  async addProjectStage(
    projectId: string,
    dto: { label: string; done?: boolean; sortOrder?: number },
  ) {
    await this.findProjectById(projectId);

    return this.prisma.projectStage.create({
      data: {
        projectId,
        label: dto.label,
        done: dto.done ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async addProjectUpdate(projectId: string, text: string, kind?: string) {
    await this.findProjectById(projectId);

    return this.prisma.projectUpdate.create({
      data: { projectId, text, kind },
    });
  }

  // ──────────────────────────────────────────────
  // PORTFOLIO ITEMS
  // ──────────────────────────────────────────────

  async findAll(filters: PortfolioFiltersDto) {
    const { type, published, governorate, q, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (type) {
      where.type = type;
    }

    if (published !== undefined) {
      where.published = published;
    }

    if (governorate) {
      where.governorate = governorate;
    }

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.portfolioItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.portfolioItem.count({ where }),
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

  async create(dto: {
    type: string;
    title: string;
    description?: string;
    governorate?: string;
    date?: string;
    published?: boolean;
    coverUrl?: string;
    body?: string;
    metadataJson?: any;
  }) {
    return this.prisma.portfolioItem.create({
      data: {
        type: dto.type,
        title: dto.title,
        description: dto.description,
        governorate: dto.governorate,
        date: dto.date ? new Date(dto.date) : undefined,
        published: dto.published ?? false,
        coverUrl: dto.coverUrl,
        body: dto.body,
        metadataJson: dto.metadataJson,
      },
    });
  }

  async update(
    id: string,
    dto: Partial<{
      type: string;
      title: string;
      description: string;
      governorate: string;
      date: string;
      published: boolean;
      coverUrl: string;
      body: string;
      metadataJson: any;
    }>,
  ) {
    const item = await this.prisma.portfolioItem.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException('العنصر غير موجود');
    }

    const { date, ...rest } = dto;

    return this.prisma.portfolioItem.update({
      where: { id },
      data: {
        ...rest,
        ...(date !== undefined ? { date: new Date(date) } : {}),
      },
    });
  }

  async delete(id: string) {
    const item = await this.prisma.portfolioItem.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException('العنصر غير موجود');
    }

    return this.prisma.portfolioItem.delete({ where: { id } });
  }

  async togglePublish(id: string) {
    const item = await this.prisma.portfolioItem.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException('العنصر غير موجود');
    }

    return this.prisma.portfolioItem.update({
      where: { id },
      data: { published: !item.published },
    });
  }

  // ──────────────────────────────────────────────
  // FOUNDATION
  // ──────────────────────────────────────────────

  async getFoundationStats() {
    return this.prisma.foundationStat.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getMilestones() {
    return this.prisma.milestone.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getValues() {
    return this.prisma.foundationValue.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getInitiatives() {
    return this.prisma.initiative.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getConsultants() {
    return this.prisma.consultant.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
