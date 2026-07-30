/**
 * Parse a time string like "09:00" into minutes since midnight.
 */
export function parseTime(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Format minutes since midnight back to "HH:MM" string.
 */
export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Generate an array of time slots between start and end using the given slot duration.
 * E.g. generateTimeSlots("09:00", "12:00", 30) → ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]
 */
export function generateTimeSlots(startTime: string, endTime: string, slotMinutes: number): string[] {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  const slots: string[] = [];

  for (let t = start; t + slotMinutes <= end; t += slotMinutes) {
    slots.push(formatTime(t));
  }

  return slots;
}

/**
 * Get the day of week (0=Sunday) for a given date string YYYY-MM-DD.
 */
export function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr).getDay();
}

/**
 * Generate an array of date strings between from and to (inclusive), format YYYY-MM-DD.
 */
export function generateDateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const current = new Date(from);
  const end = new Date(to);

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}
