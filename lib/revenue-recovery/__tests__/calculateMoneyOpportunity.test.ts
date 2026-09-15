import { describe, it, expect } from "vitest";
import { calculateMoneyOpportunity } from "../calculateMoneyOpportunity";
import type { OverdueCustomer } from "../findOverdueCustomers";

function overdue(customerId: string): OverdueCustomer {
  return {
    customerId,
    lastVisit: new Date(),
    averageIntervalDays: 30,
    daysSinceLastVisit: 60,
    daysOverdue: 30,
  };
}

describe("calculateMoneyOpportunity", () => {
  it("sums all categories and always marks the result as an estimate", () => {
    const result = calculateMoneyOpportunity({
      overdueCustomers: [overdue("c1"), overdue("c2")],
      averageSpendCentsByCustomer: { c1: 50000, c2: 30000 },
      cancelledUnrebookedAppointmentValueCents: [40000, 20000],
      pendingPaymentDueCents: [10000, 5000],
      emptySlotUpsellEstimateCents: 15000,
    });

    expect(result.inactiveCustomersCents).toBe(80000);
    expect(result.cancelledAppointmentsCents).toBe(60000);
    expect(result.pendingPaymentsCents).toBe(15000);
    expect(result.emptySlotCents).toBe(15000);
    expect(result.totalEstimatedCents).toBe(80000 + 60000 + 15000 + 15000);
    expect(result.isEstimate).toBe(true);
  });

  it("treats a customer with no recorded average spend as contributing zero, not NaN", () => {
    const result = calculateMoneyOpportunity({
      overdueCustomers: [overdue("no_spend_history")],
      averageSpendCentsByCustomer: {},
      cancelledUnrebookedAppointmentValueCents: [],
      pendingPaymentDueCents: [],
      emptySlotUpsellEstimateCents: 0,
    });
    expect(result.inactiveCustomersCents).toBe(0);
    expect(result.totalEstimatedCents).toBe(0);
  });

  it("handles all-empty input without error", () => {
    const result = calculateMoneyOpportunity({
      overdueCustomers: [],
      averageSpendCentsByCustomer: {},
      cancelledUnrebookedAppointmentValueCents: [],
      pendingPaymentDueCents: [],
      emptySlotUpsellEstimateCents: 0,
    });
    expect(result.totalEstimatedCents).toBe(0);
  });
});
