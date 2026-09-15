export interface PeakWindow {
  weekday: number; // 0-6
  startTime: string; // "HH:mm", salon-local
  endTime: string; // "HH:mm"
}

export interface PriceBreakdown {
  basePriceCents: number;
  isPeak: boolean;
  peakSurchargeCents: number;
  priorityFeeCents: number;
  totalCents: number;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function isWithinPeakWindow(start: Date, timezoneOffsetMinutes: number, windows: PeakWindow[]): boolean {
  const localMs = start.getTime() + timezoneOffsetMinutes * 60_000;
  const local = new Date(localMs);
  const weekday = local.getUTCDay();
  const minutesOfDay = local.getUTCHours() * 60 + local.getUTCMinutes();

  return windows.some((w) => {
    if (w.weekday !== weekday) return false;
    return minutesOfDay >= toMinutes(w.startTime) && minutesOfDay < toMinutes(w.endTime);
  });
}

/**
 * Computes the exact price a customer will be shown before they confirm a
 * booking (spec section 20: "Price calculation must be transparent to
 * customer before confirmation"). This same function is called both when
 * rendering the price in the booking widget AND server-side when the
 * booking is actually created — never two separate calculations that could
 * drift apart.
 */
export function calculatePrice(params: {
  basePriceCents: number;
  peakPriceCents: number | null; // absolute peak price, not a delta, per spec example (₹300 normal / ₹350 peak)
  slotStart: Date;
  timezoneOffsetMinutes: number;
  peakWindows: PeakWindow[];
  bookingType: "NORMAL" | "PRIORITY";
  priorityFeeCents: number;
}): PriceBreakdown {
  const { basePriceCents, peakPriceCents, slotStart, timezoneOffsetMinutes, peakWindows, bookingType, priorityFeeCents } =
    params;

  const isPeak = peakPriceCents != null && isWithinPeakWindow(slotStart, timezoneOffsetMinutes, peakWindows);
  const effectiveBase = isPeak ? peakPriceCents! : basePriceCents;
  const peakSurchargeCents = isPeak ? peakPriceCents! - basePriceCents : 0;
  const appliedPriorityFee = bookingType === "PRIORITY" ? priorityFeeCents : 0;

  return {
    basePriceCents,
    isPeak,
    peakSurchargeCents,
    priorityFeeCents: appliedPriorityFee,
    totalCents: effectiveBase + appliedPriorityFee,
  };
}
