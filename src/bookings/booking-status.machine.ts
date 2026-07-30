import { BadRequestException } from '@nestjs/common';
import { BOOKING_TRANSITIONS } from '../common/constants/statuses';

/**
 * Check whether a status transition is allowed.
 */
export function canTransition(from: string, to: string): boolean {
  const allowed = BOOKING_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * Validate a status transition; throws BadRequestException if the
 * transition is not permitted by the booking state machine.
 */
export function validateTransition(from: string, to: string): void {
  if (!canTransition(from, to)) {
    throw new BadRequestException({
      error: {
        code: 'INVALID_TRANSITION',
        message: `لا يمكن تغيير الحالة من "${from}" إلى "${to}"`,
      },
    });
  }
}
