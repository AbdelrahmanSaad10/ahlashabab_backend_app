import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GovernoratesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.governorate.findMany({
      include: { workAreas: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number) {
    const governorate = await this.prisma.governorate.findUnique({
      where: { id },
      include: { workAreas: true },
    });

    if (!governorate) {
      throw new NotFoundException('المحافظة غير موجودة');
    }

    return governorate;
  }
}
