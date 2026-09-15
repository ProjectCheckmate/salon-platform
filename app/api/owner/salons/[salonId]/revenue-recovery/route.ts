import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireSalonAccess } from "@/lib/permissions";
import { withAuthErrors } from "@/lib/api/withAuthErrors";
import { findOverdueCustomers } from "@/lib/revenue-recovery/findOverdueCustomers";
import { calculateMoneyOpportunity } from "@/lib/revenue-recovery/calculateMoneyOpportunity";

export const GET = withAuthErrors(async function GET(
  req: NextRequest,
  { params }: { params: { salonId: string } }
) {
  await requireSalonAccess(params.salonId);

  // Every completed appointment for this salon, grouped by customer, to
  // build each customer's real visit history — no invented data.
  const completedAppointments = await prisma.appointment.findMany({
    where: { salonId: params.salonId, status: "COMPLETED" },
    select: { customerId: true, startTime: true, totalAmountCents: true },
  });

  const byCustomer = new Map<string, { dates: Date[]; totalSpendCents: number; visitCount: number }>();
  for (const appt of completedAppointments) {
    const entry = byCustomer.get(appt.customerId) ?? { dates: [], totalSpendCents: 0, visitCount: 0 };
    entry.dates.push(appt.startTime);
    entry.totalSpendCents += appt.totalAmountCents;
    entry.visitCount += 1;
    byCustomer.set(appt.customerId, entry);
  }

  const histories = Array.from(byCustomer.entries()).map(([customerId, data]) => ({
    customerId,
    completedVisitDates: data.dates,
  }));
  const overdueCustomers = findOverdueCustomers(histories, new Date());

  const averageSpendCentsByCustomer: Record<string, number> = {};
  for (const [customerId, data] of byCustomer.entries()) {
    averageSpendCentsByCustomer[customerId] = Math.round(data.totalSpendCents / data.visitCount);
  }

  // Cancelled appointments that haven't led to a later booking by the same
  // customer at this salon (a simple heuristic: no CONFIRMED/COMPLETED
  // appointment from that customer after the cancellation date).
  const cancelled = await prisma.appointment.findMany({
    where: { salonId: params.salonId, status: "CANCELLED" },
    select: { customerId: true, totalAmountCents: true, updatedAt: true },
  });
  const cancelledUnrebookedAppointmentValueCents: number[] = [];
  for (const c of cancelled) {
    const rebooked = await prisma.appointment.findFirst({
      where: {
        customerId: c.customerId,
        salonId: params.salonId,
        status: { in: ["CONFIRMED", "COMPLETED", "PENDING"] },
        startTime: { gt: c.updatedAt },
      },
    });
    if (!rebooked) cancelledUnrebookedAppointmentValueCents.push(c.totalAmountCents);
  }

  const pendingPaymentAppointments = await prisma.appointment.findMany({
    where: {
      salonId: params.salonId,
      paymentStatus: { in: ["UNPAID", "PARTIAL"] },
      status: { in: ["COMPLETED", "CONFIRMED"] },
    },
    select: { totalAmountCents: true, paidAmountCents: true },
  });
  const pendingPaymentDueCents = pendingPaymentAppointments.map(
    (a) => a.totalAmountCents - a.paidAmountCents
  );

  const breakdown = calculateMoneyOpportunity({
    overdueCustomers,
    averageSpendCentsByCustomer,
    cancelledUnrebookedAppointmentValueCents,
    pendingPaymentDueCents,
    // Empty-slot upsell matching (spec section 32) needs the notification/
    // preference system from a later phase to estimate credibly — 0 for now
    // rather than a made-up number.
    emptySlotUpsellEstimateCents: 0,
  });

  return NextResponse.json({
    breakdown,
    overdueCustomers: overdueCustomers.slice(0, 20), // most-overdue first, capped for the dashboard
  });
});
