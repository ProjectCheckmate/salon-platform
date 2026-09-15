/**
 * Pure availability calculation. No DB writes happen here — this only
 * computes which slots are theoretically bookable given the inputs.
 * The actual booking (createAppointment.ts) re-validates everything
 * inside a transaction to close race-condition windows.
 */

export interface TimeRange {
  start: Date; // absolute UTC instants
  end: Date;
}

export interface AvailabilityInput {
  date: Date; // the calendar day being queried (salon-local)
  salonHours: { isOpen: boolean; openTime: string | null; closeTime: string | null }; // "HH:mm"
  staffHours: { isWorking: boolean; startTime: string | null; endTime: string | null };
  staffBreaks: { startTime: string; endTime: string }[]; // "HH:mm"
  existingAppointments: TimeRange[]; // this staff member's appointments that day
  isHoliday: boolean; // salon holiday or staff leave on this date
  serviceDurationMinutes: number;
  bufferMinutes: number;
  slotIntervalMinutes: number; // e.g. 30
  timezoneOffsetMinutes: number; // salon's UTC offset, e.g. 330 for IST
  now: Date; // for filtering out past slots on "today"
}

function hhmmToDate(date: Date, hhmm: string, tzOffsetMinutes: number): Date {
  const [h, m] = hhmm.split(":").map(Number);
  // Build the instant as if hh:mm is salon-local time, then shift by the
  // salon's UTC offset to get the true UTC instant.
  const local = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), h, m)
  );
  return new Date(local.getTime() - tzOffsetMinutes * 60_000);
}

function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

export function calculateAvailableSlots(input: AvailabilityInput): TimeRange[] {
  const {
    date,
    salonHours,
    staffHours,
    staffBreaks,
    existingAppointments,
    isHoliday,
    serviceDurationMinutes,
    bufferMinutes,
    slotIntervalMinutes,
    timezoneOffsetMinutes,
    now,
  } = input;

  if (isHoliday) return [];
  if (!salonHours.isOpen || !salonHours.openTime || !salonHours.closeTime) return [];
  if (!staffHours.isWorking || !staffHours.startTime || !staffHours.endTime) return [];

  // Effective working window = intersection of salon hours and staff hours
  const salonOpen = hhmmToDate(date, salonHours.openTime, timezoneOffsetMinutes);
  const salonClose = hhmmToDate(date, salonHours.closeTime, timezoneOffsetMinutes);
  const staffStart = hhmmToDate(date, staffHours.startTime, timezoneOffsetMinutes);
  const staffEnd = hhmmToDate(date, staffHours.endTime, timezoneOffsetMinutes);

  const windowStart = new Date(Math.max(salonOpen.getTime(), staffStart.getTime()));
  const windowEnd = new Date(Math.min(salonClose.getTime(), staffEnd.getTime()));
  if (windowStart >= windowEnd) return [];

  const blocked: TimeRange[] = [
    ...staffBreaks.map((b) => ({
      start: hhmmToDate(date, b.startTime, timezoneOffsetMinutes),
      end: hhmmToDate(date, b.endTime, timezoneOffsetMinutes),
    })),
    ...existingAppointments,
  ];

  const totalOccupiedMinutes = serviceDurationMinutes + bufferMinutes;
  const slots: TimeRange[] = [];

  for (
    let cursor = new Date(windowStart);
    cursor.getTime() + totalOccupiedMinutes * 60_000 <= windowEnd.getTime();
    cursor = new Date(cursor.getTime() + slotIntervalMinutes * 60_000)
  ) {
    const candidate: TimeRange = {
      start: new Date(cursor),
      end: new Date(cursor.getTime() + totalOccupiedMinutes * 60_000),
    };

    if (candidate.start < now) continue; // don't offer past slots
    if (blocked.some((b) => overlaps(candidate, b))) continue;

    slots.push({
      start: candidate.start,
      // expose only the *service* end time to the customer, not the buffer
      end: new Date(candidate.start.getTime() + serviceDurationMinutes * 60_000),
    });
  }

  return slots;
}
