import { z } from 'zod';
import { BookingStatus } from '../../common/constants/statuses';

const allStatuses = Object.values(BookingStatus) as [string, ...string[]];

export const UpdateBookingStatusSchema = z.object({
  status: z.enum(allStatuses),
});

export type UpdateBookingStatusDto = z.infer<typeof UpdateBookingStatusSchema>;
