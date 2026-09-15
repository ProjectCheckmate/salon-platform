import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSalonAccess } from "@/lib/permissions";
import { withAuthErrors } from "@/lib/api/withAuthErrors";
import { getAIProvider } from "@/lib/ai/aiProvider";
import { buildBusinessContext } from "@/lib/ai/buildBusinessContext";
import { findOverdueCustomers } from "@/lib/revenue-recovery/findOverdueCustomers";

const bodySchema = z.object({ question: z.string().min(1).max(500) });

export const POST = withAuthErrors(async function POST(
  req: NextRequest,
  { params }: { params: { salonId: string } }
) {
  await requireSalonAccess(params.salonId);
  const salonId = params.salonId;

  const json = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const startOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  const [
    todayAppointments,
    thisMonthAppointments,
    lastMonthCompleted,
    completedAppointments,
    pendingPayments,
  ] = await Promise.all([
    prisma.appointment.findMany({
      where: { salonId, startTime: { gte: startOfToday, lt: endOfToday } },
      select: { totalAmountCents: true },
    }),
    prisma.appointment.findMany({
      where: { salonId, startTime: { gte: startOfThisMonth } },
      select: { status: true, totalAmountCents: true },
    }),
    prisma.appointment.aggregate({
      where: { salonId, status: "COMPLETED", startTime: { gte: startOfLastMonth, lt: startOfThisMonth } },
      _sum: { totalAmountCents: true },
    }),
    prisma.appointment.findMany({
      where: { salonId, status: "COMPLETED" },
      select: { customerId: true, startTime: true },
    }),
    prisma.appointment.findMany({
      where: { salonId, paymentStatus: { in: ["UNPAID", "PARTIAL"] }, status: { in: ["COMPLETED", "CONFIRMED"] } },
      select: { totalAmountCents: true, paidAmountCents: true },
    }),
  ]);

  const byCustomer = new Map<string, Date[]>();
  for (const a of completedAppointments) {
    const arr = byCustomer.get(a.customerId) ?? [];
    arr.push(a.startTime);
    byCustomer.set(a.customerId, arr);
  }
  const overdueCustomers = findOverdueCustomers(
    Array.from(byCustomer.entries()).map(([customerId, dates]) => ({
      customerId,
      completedVisitDates: dates,
    })),
    now
  );

  const context = buildBusinessContext({
    todayAppointmentCount: todayAppointments.length,
    todayRevenueCents: todayAppointments.reduce((sum, a) => sum + a.totalAmountCents, 0),
    thisMonthRevenueCents: thisMonthAppointments
      .filter((a) => a.status === "COMPLETED")
      .reduce((sum, a) => sum + a.totalAmountCents, 0),
    lastMonthRevenueCents: lastMonthCompleted._sum.totalAmountCents ?? 0,
    completedThisMonth: thisMonthAppointments.filter((a) => a.status === "COMPLETED").length,
    cancelledThisMonth: thisMonthAppointments.filter((a) => a.status === "CANCELLED").length,
    noShowThisMonth: thisMonthAppointments.filter((a) => a.status === "NO_SHOW").length,
    overdueCustomers,
    pendingPaymentTotalCents: pendingPayments.reduce(
      (sum, a) => sum + (a.totalAmountCents - a.paidAmountCents),
      0
    ),
  });

  try {
    const ai = getAIProvider();
    const answer = await ai.ask(parsed.data.question, context);
    return NextResponse.json({ answer, context });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Couldn't reach the AI assistant. Make sure Ollama is running locally." },
      { status: 503 }
    );
  }
});
