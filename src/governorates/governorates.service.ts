import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GovernoratesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    // Only what a picker needs. `include: { workAreas: true }` shipped createdAt
    // and a nested work-area array on all 27 rows, on an endpoint the volunteer
    // and booking forms both call.
    return this.prisma.governorate.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number) {
    const governorate = await this.prisma.governorate.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!governorate) {
      throw new NotFoundException('المحافظة غير موجودة');
    }

    return governorate;
  }
}
