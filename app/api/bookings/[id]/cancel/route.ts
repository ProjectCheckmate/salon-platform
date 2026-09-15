import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/lib/permissions";
import { withAuthErrors } from "@/lib/api/withAuthErrors";
import { calculateCancellationFee } from "@/lib/booking-rules/cancellationPolicy";
import { logAudit } from "@/lib/audit/logAudit";
import { getNotificationProvider } from "@/lib/notifications/notificationProvider";
import { cancellationNotice, emptySlotAlert } from "@/lib/notifications/templates";
import { findCustomersForEmptySlot } from "@/lib/revenue-recovery/findCustomersForEmptySlot";
import { timeOfDayFromHour } from "@/lib/revenue-recovery/findCustomersForEmptySlot";
import { getPaymentProvider } from "@/lib/payments/paymentProvider";
import { calculateRefundAmount } from "@/lib/payments/calculateRefundAmount";

export const POST = withAuthErrors(async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireSession();
  const userId = (session.user as any).id as string;
  const role = (session.user as any).role as string;

  const appointment = await prisma.appointment.findUnique({
    where: { id: params.id },
    include: {
      customer: { include: { user: true } },
      salon: true,
      staff: true,
      services: { include: { service: true } },
    },
  });
  if (!appointment) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  // Only the customer who owns this booking, salon staff/owner, or admin may cancel it.
  const isOwningCustomer = appointment.customer.userId === userId;
  const isSalonOwner = appointment.salon.ownerId === userId;
  const isAdmin = role === "ADMIN";
  let isAssignedStaff = false;
  if (!isOwningCustomer && !isSalonOwner && !isAdmin) {
    const staffLink = await prisma.staff.findFirst({
      where: { userId, salonId: appointment.salonId, active: true },
    });
    isAssignedStaff = !!staffLink;
  }
  if (!isOwningCustomer && !isSalonOwner && !isAdmin && !isAssignedStaff) {
    return NextResponse.json({ error: "You can't cancel this booking" }, { status: 403 });
  }

  if (appointment.status === "CANCELLED" || appointment.status === "COMPLETED") {
    return NextResponse.json({ error: `Booking already ${appointment.status.toLowerCase()}` }, { status: 409 });
  }

  // Fee only applies when the customer themselves cancels late; salon-initiated
  // cancellations (owner/staff/admin) never charge the customer a fee.
  const fee = isOwningCustomer
    ? calculateCancellationFee(appointment.startTime, new Date())
    : 0;

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "CANCELLED" },
  });

  // Refund whatever was paid online, minus the cancellation fee — cash/UPI
  // payments aren't auto-refunded here since there's no provider that can
  // reverse cash; the owner handles that manually (spec section 21 doesn't
  // mandate automated refunds for offline payment methods, and pretending
  // to auto-refund cash would be a fabricated capability).
  let refundCents = 0;
  let refundSucceeded = false;
  const onlinePayment = await prisma.payment.findFirst({
    where: { appointmentId: appointment.id, method: "ONLINE", razorpayPaymentId: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  if (onlinePayment && onlinePayment.razorpayPaymentId) {
    const attemptedRefundCents = calculateRefundAmount(appointment.paidAmountCents, fee);
    if (attemptedRefundCents > 0) {
      try {
        const provider = getPaymentProvider();
        const refund = await provider.refund({
          razorpayPaymentId: onlinePayment.razorpayPaymentId,
          amountCents: attemptedRefundCents,
        });
        // Recorded as a negative Payment row so the existing "paidAmountCents
        // = sum of all Payment rows" pattern (used everywhere else in this
        // project) stays the single source of truth — no separate refund
        // total to keep in sync.
        await prisma.payment.create({
          data: {
            appointmentId: appointment.id,
            amountCents: -attemptedRefundCents,
            method: "ONLINE",
            recordedById: null,
          },
        });
        const agg = await prisma.payment.aggregate({
          where: { appointmentId: appointment.id },
          _sum: { amountCents: true },
        });
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { paidAmountCents: Math.max(agg._sum.amountCents ?? 0, 0) },
        });
        refundCents = attemptedRefundCents;
        refundSucceeded = true;
        await logAudit({
          actorId: userId,
          action: "REFUND_ISSUED",
          entity: "Appointment",
          entityId: appointment.id,
          metadata: { refundCents, razorpayRefundId: refund.refundId },
        });
      } catch (err) {
        // A failed refund must never silently disappear — surfaced via
        // audit log so the owner can see it and refund manually if the
        // automated attempt failed. The cancellation itself still succeeds;
        // a refund failure shouldn't trap the customer in a booking they
        // already cancelled. Note refundCents stays 0 here — the response
        // must never claim a refund happened when it didn't.
        console.error("Refund failed:", err);
        await logAudit({
          actorId: userId,
          action: "REFUND_FAILED",
          entity: "Appointment",
          entityId: appointment.id,
          metadata: { attemptedRefundCents, error: String(err) },
        });
      }
    }
  }

  await logAudit({
    actorId: userId,
    action: "APPOINTMENT_CANCELLED",
    entity: "Appointment",
    entityId: appointment.id,
    metadata: { cancellationFeeCents: fee, cancelledBy: isOwningCustomer ? "customer" : "salon" },
  });

  // Best-effort notification — a failure here should never fail the
  // cancellation itself, so it's deliberately outside the critical path
  // and swallowed with a log rather than propagated.
  const contact = appointment.customer.user.phone ?? appointment.customer.user.email;
  if (contact) {
    const text = cancellationNotice({
      customerName: appointment.customer.user.name ?? "there",
      salonName: appointment.salon.name,
      dateTime: appointment.startTime.toLocaleString(),
      feeRupees: fee / 100,
    });
    getNotificationProvider()
      .send({
        to: contact,
        channel: appointment.customer.user.phone ? "WHATSAPP" : "EMAIL",
        templateKey: "cancellationNotice",
        variables: {},
        renderedText: text,
      })
      .catch((err) => console.error("Notification send failed:", err));
  }

  // Empty-slot recovery (spec section 32): a cancellation just freed real
  // capacity, so look for customers whose own booking history says this
  // weekday/time-of-day/service is genuinely their pattern, and who've
  // opted into notifications. Deliberately not awaited so it never delays
  // the cancellation response.
  // HONEST CAVEAT: on a serverless platform (e.g. Vercel), an unawaited
  // promise like this can be killed the moment the response is sent,
  // before it actually finishes. A production version needs either
  // `waitUntil()` (on platforms that support it) or to push this onto a
  // real background queue instead of firing it inline here.
  (async () => {
    try {
      const weekday = appointment.startTime.getUTCDay();
      const localHour = (appointment.startTime.getUTCHours() + Math.floor(330 / 60)) % 24; // +5:30 IST, hour-only approximation
      const firstServiceId = appointment.services[0]?.serviceId;
      if (!firstServiceId) return;

      const history = await prisma.appointment.findMany({
        where: {
          salonId: appointment.salonId,
          status: "COMPLETED",
          customerId: { not: appointment.customerId }, // never suggest the slot back to the person who just cancelled it
        },
        include: { customer: true, services: true },
        take: 500, // bounded scan — a salon with more history than this needs a real background job, not a request-time scan
      });

      const byCustomer = new Map<string, { weekdays: number[]; hours: number[]; serviceIds: string[]; optedIn: boolean }>();
      for (const h of history) {
        const entry = byCustomer.get(h.customerId) ?? { weekdays: [], hours: [], serviceIds: [], optedIn: h.customer.notificationsOptedIn };
        entry.weekdays.push(h.startTime.getUTCDay());
        entry.hours.push((h.startTime.getUTCHours() + Math.floor(330 / 60)) % 24);
        entry.serviceIds.push(...h.services.map((s) => s.serviceId));
        byCustomer.set(h.customerId, entry);
      }

      const patterns = Array.from(byCustomer.entries()).map(([customerId, e]) => ({
        customerId,
        pastWeekdays: e.weekdays,
        pastTimesOfDay: e.hours.map(timeOfDayFromHour),
        pastServiceIds: e.serviceIds,
        notificationsOptedIn: e.optedIn,
      }));

      const matches = findCustomersForEmptySlot({ weekday, hour: localHour, serviceId: firstServiceId }, patterns).slice(0, 5);
      if (matches.length === 0) return;

      const matchedCustomers = await prisma.customerProfile.findMany({
        where: { id: { in: matches.map((m) => m.customerId) } },
        include: { user: true },
      });

      const provider = getNotificationProvider();
      for (const c of matchedCustomers) {
        const contact = c.user.phone ?? c.user.email;
        if (!contact) continue;
        const text = emptySlotAlert({
          customerName: c.user.name ?? "there",
          salonName: appointment.salon.name,
          slotTime: appointment.startTime.toLocaleString(),
        });
        await provider.send({
          to: contact,
          channel: c.user.phone ? "WHATSAPP" : "EMAIL",
          templateKey: "emptySlotAlert",
          variables: {},
          renderedText: text,
        });
      }
    } catch (err) {
      console.error("Empty-slot matching failed:", err);
    }
  })();

  return NextResponse.json({
    appointment: { ...updated, paidAmountCents: updated.paidAmountCents - refundCents },
    cancellationFeeCents: fee,
    refundCents, // only ever non-zero when refundSucceeded is true — see the try/catch above
  });
});
