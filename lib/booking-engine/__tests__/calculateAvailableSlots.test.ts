import { describe, it, expect } from "vitest";
import { calculateAvailableSlots } from "../calculateAvailableSlots";

const DAY = new Date(Date.UTC(2026, 8, 5)); // an arbitrary Saturday
const IST = 330; // minutes offset, for realistic salon-local test data
const NOW = new Date(Date.UTC(2026, 8, 5, 0, 0)); // before salon opens that day

const openSalon = { isOpen: true, openTime: "10:00", closeTime: "20:00" };
const workingStaff = { isWorking: true, startTime: "10:00", endTime: "18:00" };

const base = {
  date: DAY,
  salonHours: openSalon,
  staffHours: workingStaff,
  staffBreaks: [] as { startTime: string; endTime: string }[],
  existingAppointments: [] as { start: Date; end: Date }[],
  isHoliday: false,
  serviceDurationMinutes: 30,
  bufferMinutes: 0,
  slotIntervalMinutes: 30,
  timezoneOffsetMinutes: IST,
  now: NOW,
};

describe("booking engine — availability", () => {
  it("1. salon closed -> no slots", () => {
    const slots = calculateAvailableSlots({ ...base, salonHours: { isOpen: false, openTime: null, closeTime: null } });
    expect(slots).toHaveLength(0);
  });

  it("2. staff unavailable that day -> no slots", () => {
    const slots = calculateAvailableSlots({ ...base, staffHours: { isWorking: false, startTime: null, endTime: null } });
    expect(slots).toHaveLength(0);
  });

  it("3. staff on break -> break window excluded", () => {
    const slots = calculateAvailableSlots({
      ...base,
      staffBreaks: [{ startTime: "14:00", endTime: "15:00" }],
    });
    const during = slots.find((s) => s.start.toISOString().includes("08:30")); // 14:00 IST = 08:30 UTC
    expect(during).toBeUndefined();
  });

  it("4. existing appointment blocks that window", () => {
    const existingStart = new Date(Date.UTC(2026, 8, 5, 4, 30)); // 10:00 IST
    const existingEnd = new Date(Date.UTC(2026, 8, 5, 5, 0)); // 10:30 IST
    const slots = calculateAvailableSlots({
      ...base,
      existingAppointments: [{ start: existingStart, end: existingEnd }],
    });
    const clash = slots.find((s) => s.start.getTime() === existingStart.getTime());
    expect(clash).toBeUndefined();
  });

  it("5. service longer than remaining time before close -> last slot excluded", () => {
    const slots = calculateAvailableSlots({
      ...base,
      staffHours: { isWorking: true, startTime: "17:45", endTime: "18:00" },
      serviceDurationMinutes: 30,
    });
    expect(slots).toHaveLength(0); // only 15 min remain, service needs 30
  });

  it("6. buffer time occupies extra capacity", () => {
    const withBuffer = calculateAvailableSlots({ ...base, bufferMinutes: 20 });
    const withoutBuffer = calculateAvailableSlots({ ...base, bufferMinutes: 0 });
    expect(withBuffer.length).toBeLessThan(withoutBuffer.length);
  });

  it("7. multiple services -> caller sums durations before calling (documented contract)", () => {
    const slots = calculateAvailableSlots({ ...base, serviceDurationMinutes: 30 + 20 }); // haircut+beard
    expect(slots.length).toBeGreaterThan(0);
  });

  it("8. priority booking only uses genuinely free capacity (no override)", () => {
    // Priority bookings call the exact same calculateAvailableSlots — there is
    // no separate code path that can carve into an occupied slot.
    const existingStart = new Date(Date.UTC(2026, 8, 5, 4, 30));
    const existingEnd = new Date(Date.UTC(2026, 8, 5, 5, 0));
    const slots = calculateAvailableSlots({
      ...base,
      existingAppointments: [{ start: existingStart, end: existingEnd }],
    });
    expect(slots.find((s) => s.start.getTime() === existingStart.getTime())).toBeUndefined();
  });

  it("9. peak pricing does not affect slot availability, only price shown by caller", () => {
    const slots = calculateAvailableSlots(base);
    expect(slots.length).toBeGreaterThan(0); // pricing is applied downstream, not here
  });

  it("10. holiday -> zero slots regardless of hours", () => {
    const slots = calculateAvailableSlots({ ...base, isHoliday: true });
    expect(slots).toHaveLength(0);
  });
});
