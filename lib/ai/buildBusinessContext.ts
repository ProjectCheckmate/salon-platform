import type { OverdueCustomer } from "@/lib/revenue-recovery/findOverdueCustomers";

export interface BusinessContextInput {
  todayAppointmentCount: number;
  todayRevenueCents: number;
  thisMonthRevenueCents: number;
  lastMonthRevenueCents: number;
  completedThisMonth: number;
  cancelledThisMonth: number;
  noShowThisMonth: number;
  overdueCustomers: OverdueCustomer[];
  pendingPaymentTotalCents: number;
}

/**
 * The AI is only ever allowed to see this shaped object — never raw model
 * instances, never anything it could mistake for an instruction. Every
 * field here traces to a real query the API route ran; nothing is
 * estimated or invented at this layer (spec section 41: "Do not allow AI
 * to invent financial numbers. AI responses must be grounded in actual
 * database data.").
 */
export function buildBusinessContext(input: BusinessContextInput) {
  const revenueChangePct =
    input.lastMonthRevenueCents > 0
      ? Math.round(
          ((input.thisMonthRevenueCents - input.lastMonthRevenueCents) / input.lastMonthRevenueCents) * 100
        )
      : null;

  return {
    today: {
      appointmentCount: input.todayAppointmentCount,
      revenueRupees: input.todayRevenueCents / 100,
    },
    thisMonth: {
      revenueRupees: input.thisMonthRevenueCents / 100,
      completedAppointments: input.completedThisMonth,
      cancelledAppointments: input.cancelledThisMonth,
      noShows: input.noShowThisMonth,
      revenueChangeVsLastMonthPercent: revenueChangePct, // null when there's no prior-month baseline to compare against
    },
    overdueCustomersToContact: input.overdueCustomers.slice(0, 10).map((c) => ({
      customerId: c.customerId,
      daysOverdue: c.daysOverdue,
      averageIntervalDays: c.averageIntervalDays,
    })),
    pendingPaymentTotalRupees: input.pendingPaymentTotalCents / 100,
  };
}
