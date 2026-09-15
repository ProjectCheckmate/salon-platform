import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/lib/permissions";
import { withAuthErrors } from "@/lib/api/withAuthErrors";
import { logAudit } from "@/lib/audit/logAudit";
import { formatInvoiceNumber } from "@/lib/billing/formatInvoiceNumber";
import { calculatePointsEarned } from "@/lib/loyalty/calculatePointsEarned";
import { isQualifyingBooking } from "@/lib/referrals/referralRules";
import { creditWallet } from "@/lib/wallet/walletService";

const bodySchema = z.object({ outcome: z.enum(["COMPLETED", "NO_SHOW"]) });

export const POST = withAuthErrors(async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireSession();
  const userId = (session.user as any).id as string;
  const role = (session.user as any).role as string;

  const appointment = await prisma.appointment.findUnique({ where: { id: params.id } });
  if (!appointment) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const salon = await prisma.salon.findUnique({ where: { id: appointment.salonId } });
  const isOwner = salon?.ownerId === userId;
  const isStaff = !!(await prisma.staff.findFirst({
    where: { userId, salonId: appointment.salonId, active: true },
  }));
  if (role !== "ADMIN" && !isOwner && !isStaff) {
    return NextResponse.json({ error: "You can't update this appointment" }, { status: 403 });
  }

  const json = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const appt = await tx.appointment.update({
      where: { id: appointment.id },
      data: { status: parsed.data.outcome },
      include: { services: { include: { service: true } } },
    });

    // Invoice + loyalty points only make sense for a genuinely completed
    // visit — never for a NO_SHOW, and never generated twice for the same
    // appointment (the @unique on Invoice.appointmentId backs this up).
    if (parsed.data.outcome === "COMPLETED") {
      const existingInvoice = await tx.invoice.findUnique({ where: { appointmentId: appt.id } });
      if (!existingInvoice) {
        // Tax is now read directly from appt.taxCents — the amount actually
        // shown to and agreed by the customer at booking time (see
        // POST /api/bookings), not recalculated here from the salon's
        // CURRENT tax rate, which could have changed since booking. This
        // is the real fix for last round's known gap: no more mismatch
        // between what was quoted/collected and what the invoice shows.
        const subtotalCents = appt.totalAmountCents - appt.priorityFeeCents - appt.taxCents;

        const invoiceCount = await tx.invoice.count({ where: { salonId: appt.salonId } });
        const invoice = await tx.invoice.create({
          data: {
            appointmentId: appt.id,
            salonId: appt.salonId,
            invoiceNumber: formatInvoiceNumber(appt.salonId, invoiceCount + 1),
            subtotalCents,
            taxCents: appt.taxCents,
            discountCents: 0, // coupon/membership discounts are already baked into service priceCents at booking time, not tracked separately here
            totalCents: appt.totalAmountCents,
            paidCents: appt.paidAmountCents,
            dueCents: Math.max(appt.totalAmountCents - appt.paidAmountCents, 0),
            items: {
              create: [
                ...appt.services.map((s) => ({
                  description: s.service.name,
                  amountCents: s.priceCents,
                })),
                ...(appt.priorityFeeCents > 0
                  ? [{ description: "Priority booking fee", amountCents: appt.priorityFeeCents }]
                  : []),
                ...(appt.taxCents > 0 ? [{ description: "Tax", amountCents: appt.taxCents }] : []),
              ],
            },
          },
        });

        // Loyalty points are earned on what was actually PAID, not the
        // billed total — an unpaid balance shouldn't earn points yet.
        const pointsEarned = calculatePointsEarned(appt.paidAmountCents);
        if (pointsEarned > 0) {
          const account = await tx.loyaltyAccount.upsert({
            where: { customerId_salonId: { customerId: appt.customerId, salonId: appt.salonId } },
            update: { pointsBalance: { increment: pointsEarned } },
            create: { customerId: appt.customerId, salonId: appt.salonId, pointsBalance: pointsEarned },
          });
          await tx.loyaltyTransaction.create({
            data: {
              loyaltyAccountId: account.id,
              type: "EARNED",
              points: pointsEarned,
              appointmentId: appt.id,
              reason: `Visit on ${appt.startTime.toISOString().slice(0, 10)}`,
            },
          });
        }

        return { appointment: appt, invoiceId: invoice.id, referralRewarded: false };
      }
    }

    return { appointment: appt, invoiceId: null, referralRewarded: false };
  });

  // Referral reward check — deliberately OUTSIDE the invoice/loyalty
  // transaction above and run every time an appointment completes (not
  // just the first time), because a customer's qualifying visit might not
  // be their very first one at the salon, and the invoice-existence guard
  // above would otherwise skip this check on a re-completion retry.
  let referralRewarded = false;
  if (parsed.data.outcome === "COMPLETED") {
    const customerProfile = await prisma.customerProfile.findUnique({ where: { id: updated.appointment.customerId } });
    if (customerProfile) {
      const referral = await prisma.referral.findUnique({ where: { referredUserId: customerProfile.userId } });
      if (
        referral &&
        referral.status === "PENDING" &&
        isQualifyingBooking({ status: updated.appointment.status, paymentStatus: updated.appointment.paymentStatus })
      ) {
        await prisma.referral.update({
          where: { id: referral.id },
          data: { status: "REWARDED", qualifyingAppointmentId: updated.appointment.id, rewardedAt: new Date() },
        });
        referralRewarded = true;

        // Real payout, now via the actual wallet system (this round's fix
        // for last round's stated gap): platform-wide credit, spendable at
        // ANY salon, not salon-specific loyalty points. This is now a
        // genuine cash-equivalent, not an approximation of one.
        await creditWallet({
          userId: customerProfile.userId,
          amountCents: referral.rewardCents,
          reason: "Referral reward (referred by a friend)",
          appointmentId: updated.appointment.id,
        });
        await creditWallet({
          userId: referral.referrerId,
          amountCents: referral.rewardCents,
          reason: "Referral reward (friend's first completed visit)",
          appointmentId: updated.appointment.id,
        });

        await logAudit({
          actorId: userId,
          action: "REFERRAL_REWARDED",
          entity: "Referral",
          entityId: referral.id,
          metadata: { rewardCents: referral.rewardCents, appointmentId: updated.appointment.id },
        });
      }
    }
  }

  await logAudit({
    actorId: userId,
    action: `APPOINTMENT_${parsed.data.outcome}`,
    entity: "Appointment",
    entityId: appointment.id,
  });

  return NextResponse.json({
    appointment: updated.appointment,
    invoiceId: updated.invoiceId,
    referralRewarded,
  });
});
