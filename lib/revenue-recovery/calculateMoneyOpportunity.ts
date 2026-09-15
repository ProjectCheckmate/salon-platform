import type { OverdueCustomer } from "./findOverdueCustomers";

export interface MoneyOpportunityInput {
  overdueCustomers: OverdueCustomer[];
  averageSpendCentsByCustomer: Record<string, number>; // customer's historical average bill
  cancelledUnrebookedAppointmentValueCents: number[]; // one entry per cancelled, not-yet-rebooked appointment
  pendingPaymentDueCents: number[]; // one entry per appointment with a due balance
  emptySlotUpsellEstimateCents: number; // rough estimate from Phase 6's slot-recovery matching, computed elsewhere
}

export interface MoneyOpportunityBreakdown {
  inactiveCustomersCents: number;
  cancelledAppointmentsCents: number;
  pendingPaymentsCents: number;
  emptySlotCents: number;
  totalEstimatedCents: number;
  isEstimate: true; // always present as a reminder this is never guaranteed income
}

/**
 * Every number here is explicitly an ESTIMATE (spec section 40: "All revenue
 * estimates must be clearly labelled as estimates, not guaranteed income").
 * Nothing in this function invents a number — every input must be computed
 * from real historical/DB data by the caller.
 */
export function calculateMoneyOpportunity(input: MoneyOpportunityInput): MoneyOpportunityBreakdown {
  const inactiveCustomersCents = input.overdueCustomers.reduce((sum, c) => {
    const avgSpend = input.averageSpendCentsByCustomer[c.customerId] ?? 0;
    return sum + avgSpend;
  }, 0);

  const cancelledAppointmentsCents = input.cancelledUnrebookedAppointmentValueCents.reduce(
    (sum, v) => sum + v,
    0
  );

  const pendingPaymentsCents = input.pendingPaymentDueCents.reduce((sum, v) => sum + v, 0);

  const totalEstimatedCents =
    inactiveCustomersCents +
    cancelledAppointmentsCents +
    pendingPaymentsCents +
    input.emptySlotUpsellEstimateCents;

  return {
    inactiveCustomersCents,
    cancelledAppointmentsCents,
    pendingPaymentsCents,
    emptySlotCents: input.emptySlotUpsellEstimateCents,
    totalEstimatedCents,
    isEstimate: true,
  };
}
