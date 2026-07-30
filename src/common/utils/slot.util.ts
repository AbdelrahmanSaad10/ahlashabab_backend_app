import { generateTimeSlots, getDayOfWeek, generateDateRange } from './date.util';

export interface ScheduleEntry {
  weekday: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
}

export interface DayAvailability {
  date: string;
  slots: string[];
}

/**
 * Generate available slots for a provider over a date range.
 *
 * 1. For each date in range, find the matching weekday schedule.
 * 2. Generate all possible time slots from that schedule.
 * 3. Exclude unavailable dates.
 * 4. Exclude already-booked slots.
 *
 * Returns only dates that have at least one open slot.
 */
export function generateAvailableSlots(
  schedules: ScheduleEntry[],
  unavailableDates: string[],
  bookedSlots: Map<string, Set<string>>,
  from: string,
  to: string,
): DayAvailability[] {
  const unavailableSet = new Set(unavailableDates);
  const result: DayAvailability[] = [];
  const dates = generateDateRange(from, to);

  // Build a schedule lookup by weekday
  const scheduleByDay = new Map<number, ScheduleEntry>();
  for (const s of schedules) {
    scheduleByDay.set(s.weekday, s);
  }

  for (const date of dates) {
    // Skip unavailable dates
    if (unavailableSet.has(date)) continue;

    const dayOfWeek = getDayOfWeek(date);
    const schedule = scheduleByDay.get(dayOfWeek);

    // No schedule for this weekday → provider doesn't work
    if (!schedule) continue;

    // Generate all possible slots
    const allSlots = generateTimeSlots(schedule.startTime, schedule.endTime, schedule.slotMinutes);

    // Remove booked slots
    const booked = bookedSlots.get(date) ?? new Set<string>();
    const openSlots = allSlots.filter((slot) => !booked.has(slot));

    if (openSlots.length > 0) {
      result.push({ date, slots: openSlots });
    }
  }

  return result;
}
