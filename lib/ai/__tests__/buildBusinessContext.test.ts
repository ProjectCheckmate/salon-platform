import { describe, it, expect } from "vitest";
import { buildBusinessContext } from "../buildBusinessContext";

const baseInput = {
  todayAppointmentCount: 5,
  todayRevenueCents: 250000,
  thisMonthRevenueCents: 4500000,
  lastMonthRevenueCents: 4000000,
  completedThisMonth: 90,
  cancelledThisMonth: 10,
  noShowThisMonth: 3,
  overdueCustomers: [],
  pendingPaymentTotalCents: 150000,
};

describe("buildBusinessContext", () => {
  it("converts cents to rupees for readability", () => {
    const ctx = buildBusinessContext(baseInput);
    expect(ctx.today.revenueRupees).toBe(2500);
    expect(ctx.thisMonth.revenueRupees).toBe(45000);
  });

  it("computes month-over-month percent change correctly", () => {
    const ctx = buildBusinessContext(baseInput);
    expect(ctx.thisMonth.revenueChangeVsLastMonthPercent).toBe(13); // (4500000-4000000)/4000000 = 12.5% -> rounds to 13
  });

  it("returns null change (not a fabricated 0%) when there's no prior month to compare", () => {
    const ctx = buildBusinessContext({ ...baseInput, lastMonthRevenueCents: 0 });
    expect(ctx.thisMonth.revenueChangeVsLastMonthPercent).toBeNull();
  });

  it("caps overdue customers shown to the AI at 10, most-relevant already sorted by the caller", () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      customerId: `c${i}`,
      lastVisit: new Date(),
      averageIntervalDays: 30,
      daysSinceLastVisit: 60,
      daysOverdue: 30,
    }));
    const ctx = buildBusinessContext({ ...baseInput, overdueCustomers: many });
    expect(ctx.overdueCustomersToContact).toHaveLength(10);
  });
});
