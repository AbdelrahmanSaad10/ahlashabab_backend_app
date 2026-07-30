import { z } from 'zod';
import { DonationStatus, DonationMethod } from '../../common/constants/statuses';

const allStatuses = Object.values(DonationStatus) as [string, ...string[]];
const allMethods = Object.values(DonationMethod) as [string, ...string[]];

export const DonationFiltersSchema = z.object({
  status: z.enum(allStatuses).optional(),
  method: z.enum(allMethods).optional(),
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type DonationFiltersDto = z.infer<typeof DonationFiltersSchema>;
