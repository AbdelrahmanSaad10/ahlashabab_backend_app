import { z } from 'zod';
import { BookingStatus } from '../../common/constants/statuses';

const allStatuses = Object.values(BookingStatus) as [string, ...string[]];

export const BookingFiltersSchema = z.object({
  status: z.enum(allStatuses).optional(),
  categoryId: z.string().uuid().optional(),
  providerId: z.string().uuid().optional(),
  governorateId: z.coerce.number().int().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type BookingFiltersDto = z.infer<typeof BookingFiltersSchema>;
