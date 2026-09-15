import { describe, it, expect } from "vitest";
import { calculatePrice } from "../calculatePrice";

const IST = 330;
// Saturday 2026-09-05, 18:30 IST = 13:00 UTC
const peakSlot = new Date("2026-09-05T13:00:00Z");
// Same day, 11:00 IST = 05:30 UTC (outside peak window)
const offPeakSlot = new Date("2026-09-05T05:30:00Z");

const peakWindows = [{ weekday: 6, startTime: "18:00", endTime: "21:00" }]; // Saturday evenings

describe("peak pricing", () => {
  it("applies peak price during a defined peak window", () => {
    const result = calculatePrice({
      basePriceCents: 30000,
      peakPriceCents: 35000,
      slotStart: peakSlot,
      timezoneOffsetMinutes: IST,
      peakWindows,
      bookingType: "NORMAL",
      priorityFeeCents: 0,
    });
    expect(result.isPeak).toBe(true);
    expect(result.totalCents).toBe(35000);
    expect(result.peakSurchargeCents).toBe(5000);
  });

  it("uses base price outside peak window", () => {
    const result = calculatePrice({
      basePriceCents: 30000,
      peakPriceCents: 35000,
      slotStart: offPeakSlot,
      timezoneOffsetMinutes: IST,
      peakWindows,
      bookingType: "NORMAL",
      priorityFeeCents: 0,
    });
    expect(result.isPeak).toBe(false);
    expect(result.totalCents).toBe(30000);
  });

  it("stacks priority fee on top of peak price", () => {
    const result = calculatePrice({
      basePriceCents: 30000,
      peakPriceCents: 35000,
      slotStart: peakSlot,
      timezoneOffsetMinutes: IST,
      peakWindows,
      bookingType: "PRIORITY",
      priorityFeeCents: 15000,
    });
    expect(result.totalCents).toBe(35000 + 15000);
  });

  it("no peak price configured -> never peak, even inside a window", () => {
    const result = calculatePrice({
      basePriceCents: 30000,
      peakPriceCents: null,
      slotStart: peakSlot,
      timezoneOffsetMinutes: IST,
      peakWindows,
      bookingType: "NORMAL",
      priorityFeeCents: 0,
    });
    expect(result.isPeak).toBe(false);
    expect(result.totalCents).toBe(30000);
  });
});
