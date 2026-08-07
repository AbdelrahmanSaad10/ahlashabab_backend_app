import 'reflect-metadata';
import { UpdateScheduleSchema } from '../src/providers/dto/update-schedule.dto';
import { UnavailableDateSchema } from '../src/providers/dto/unavailable-date.dto';
import { generateTimeSlots } from '../src/common/utils/date.util';

/**
 * The dashboard's provider schedule editor writes straight into these DTOs
 * (T-19). It previously edited day indexes plus Arabic slot labels ('10:00 ص')
 * that this API cannot express at all — the server keeps ONE range per weekday
 * and steps it by `slotMinutes`.
 *
 * These pin the contract from the client's side: the exact payload the editor
 * builds must validate, and the count it shows the admin ("8 موعد") must equal
 * the number of slots the booking engine will actually generate. If those two
 * ever diverge, an admin is told a different number of appointments than the
 * app offers.
 */
describe('provider schedule contract (dashboard → API)', () => {
  /** Mirrors `slotCount` in dashboard `pages/Providers.tsx`. */
  const uiSlotCount = (r: { startTime: string; endTime: string; slotMinutes: number }) => {
    const mins = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const span = mins(r.endTime) - mins(r.startTime);
    return span > 0 && r.slotMinutes > 0 ? Math.floor(span / r.slotMinutes) : 0;
  };

  /** What the editor sends when a full week is configured. */
  const editorPayload = {
    schedules: [
      { weekday: 0, startTime: '09:00', endTime: '17:00', slotMinutes: 60 },
      { weekday: 1, startTime: '09:00', endTime: '12:30', slotMinutes: 30 },
      { weekday: 3, startTime: '14:00', endTime: '20:00', slotMinutes: 45 },
      { weekday: 6, startTime: '08:00', endTime: '20:00', slotMinutes: 15 },
    ],
  };

  it('accepts the payload the editor builds', () => {
    expect(UpdateScheduleSchema.safeParse(editorPayload).success).toBe(true);
  });

  it('accepts an empty week — clearing a provider’s schedule is legitimate', () => {
    expect(UpdateScheduleSchema.safeParse({ schedules: [] }).success).toBe(true);
  });

  it('shows the admin exactly the slot count the booking engine will generate', () => {
    for (const r of editorPayload.schedules) {
      expect(uiSlotCount(r)).toBe(generateTimeSlots(r.startTime, r.endTime, r.slotMinutes).length);
    }
  });

  it('rejects the empty time an unfilled <input type="time"> would send', () => {
    const bad = { schedules: [{ weekday: 0, startTime: '', endTime: '17:00', slotMinutes: 60 }] };
    expect(UpdateScheduleSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a 12-hour label — the shape the old editor used', () => {
    const bad = { schedules: [{ weekday: 0, startTime: '9:00 ص', endTime: '5:00 م', slotMinutes: 60 }] };
    expect(UpdateScheduleSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a weekday outside 0–6 and a slot length outside 5–480', () => {
    const day = { schedules: [{ weekday: 7, startTime: '09:00', endTime: '17:00', slotMinutes: 60 }] };
    const len = { schedules: [{ weekday: 0, startTime: '09:00', endTime: '17:00', slotMinutes: 1 }] };
    expect(UpdateScheduleSchema.safeParse(day).success).toBe(false);
    expect(UpdateScheduleSchema.safeParse(len).success).toBe(false);
  });

  it('rejects an end before a start — a zero-slot day is never a real schedule', () => {
    // The DTO used to validate each field and never the pair, so this stored
    // fine and yielded no bookable slots: a provider that looks scheduled and
    // can never be booked. Now refused server-side as well as in the editor.
    const inverted = { weekday: 2, startTime: '17:00', endTime: '09:00', slotMinutes: 60 };
    expect(UpdateScheduleSchema.safeParse({ schedules: [inverted] }).success).toBe(false);
    expect(generateTimeSlots(inverted.startTime, inverted.endTime, inverted.slotMinutes)).toHaveLength(0);
    expect(uiSlotCount(inverted)).toBe(0);
  });

  it('rejects a range too short for even one slot', () => {
    const tooShort = { weekday: 2, startTime: '09:00', endTime: '09:20', slotMinutes: 30 };
    expect(UpdateScheduleSchema.safeParse({ schedules: [tooShort] }).success).toBe(false);
    expect(uiSlotCount(tooShort)).toBe(0);
  });

  it('accepts the blocked-date format the editor’s <input type="date"> produces', () => {
    expect(UnavailableDateSchema.safeParse({ date: '2026-08-14' }).success).toBe(true);
    expect(UnavailableDateSchema.safeParse({ date: '14/08/2026' }).success).toBe(false);
  });
});
