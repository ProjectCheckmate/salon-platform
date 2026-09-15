import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/lib/permissions";
import { createAppointment, SlotUnavailableError } from "@/lib/booking-engine/createAppointment";
import { calculatePrice } from "@/lib/pricing/calculatePrice";
import { applyMembership } from "@/lib/memberships/applyMembership";
import { withAuthErrors } from "@/lib/api/withAuthErrors";
import { getNotificationProvider } from "@/lib/notifications/notificationProvider";
import { bookingConfirmation } from "@/lib/notifications/templates";
import { applyCoupon } from "@/lib/coupons/applyCoupon";
import { calculateTax } from "@/lib/tax/calculateTax";
import { calculateWalletApplication } from "@/lib/wallet/calculateWalletApplication";
import { debitWallet } from "@/lib/wallet/walletService";

const bodySchema = z.object({
  salonId: z.string(),
  staffId: z.string(),
  serviceIds: z.array(z.string()).min(1),
  startTime: z.string().datetime(),
  bookingType: z.enum(["NORMAL", "PRIORITY"]).default("NORMAL"),
  couponCode: z.string().optional(),
  useWalletCents: z.number().int().min(0).default(0), // how much of their wallet balance to apply, per spec section 37's referral credit
});

export const POST = withAuthErrors(async function POST(req: NextRequest) {
  const session = await requireSession();
  const userId = (session.user as any).id as string;

  const json = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { salonId, staffId, serviceIds, startTime, bookingType, couponCode, useWalletCents } = parsed.data;

  const customerProfile = await prisma.customerProfile.findUnique({ where: { userId } });
  if (!customerProfile) {
    return NextResponse.json({ error: "Customer profile not found" }, { status: 404 });
  }

  // Prices and durations are re-fetched from the DB — never trusted from the client.
  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds }, salonId, active: true },
  });
  if (services.length !== serviceIds.length) {
    return NextResponse.json({ error: "One or more services are invalid" }, { status: 400 });
  }

  const salon = await prisma.salon.findUnique({ where: { id: salonId } });
  if (!salon || salon.status !== "APPROVED") {
    return NextResponse.json({ error: "Salon not available for booking" }, { status: 404 });
  }

  if (bookingType === "PRIORITY" && !services.some((s) => s.priorityAllowed)) {
    return NextResponse.json({ error: "Priority booking not available for this service" }, { status: 400 });
  }

  const totalDuration = services.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalBuffer = Math.max(...services.map((s) => s.bufferMinutes), 0);
  const start = new Date(startTime);
  const end = new Date(start.getTime() + (totalDuration + totalBuffer) * 60_000);

  const priorityFeeCents = bookingType === "PRIORITY" ? 15000 : 0; // TODO: pull from salon settings

  // Re-derive each service's price server-side at the ACTUAL booked start
  // time — same calculatePrice() the availability API used to show the
  // customer their price, so what they saw is exactly what they're charged,
  // and a client can never submit a stale/manipulated price.
  const peakWindows = await prisma.peakHourWindow.findMany({ where: { salonId } });

  // Look up the customer's most recent non-expired membership purchase at
  // THIS salon, with how many times each benefit has already been used.
  const activePurchase = await prisma.membershipPurchase.findFirst({
    where: { customerId: customerProfile.id, membership: { salonId }, expiresAt: { gt: start } },
    include: { membership: { include: { benefits: true } }, usages: true },
    orderBy: { purchasedAt: "desc" },
  });
  const activeMembership = activePurchase
    ? {
        discountPercent: activePurchase.membership.discountPercent,
        expiresAt: activePurchase.expiresAt,
        benefits: activePurchase.membership.benefits.map((b) => ({
          serviceId: b.serviceId,
          includedCount: b.includedCount,
          usedCount: activePurchase.usages.filter((u) => u.serviceId === b.serviceId).length,
        })),
      }
    : null;

  const membershipApplications = new Map<string, ReturnType<typeof applyMembership>>();
  const pricedServices = services.map((s) => {
    const priced = calculatePrice({
      basePriceCents: s.priceCents,
      peakPriceCents: s.peakPriceCents,
      slotStart: start,
      timezoneOffsetMinutes: 330,
      peakWindows,
      bookingType: "NORMAL", // priority fee is applied once at the appointment level below, not per-service
      priorityFeeCents: 0,
    });
    const membershipDiscount = applyMembership(activeMembership, s.id, priced.totalCents, start);
    membershipApplications.set(s.id, membershipDiscount);
    return {
      serviceId: s.id,
      priceCents: Math.max(priced.totalCents - membershipDiscount.discountCents, 0),
      durationMinutes: s.durationMinutes,
    };
  });

  // Coupon is validated against real DB usage counts, then its discount is
  // spread across the priced services (reducing from the last one first)
  // so the sum of service prices actually reflects the discount — never
  // just a client-trusted final total.
  let appliedCoupon: { id: string; discountCents: number } | null = null;
  if (couponCode) {
    const coupon = await prisma.coupon.findUnique({ where: { salonId_code: { salonId, code: couponCode.toUpperCase() } } });
    if (!coupon) {
      return NextResponse.json({ error: "Invalid coupon code" }, { status: 400 });
    }
    const [totalUses, customerUses] = await Promise.all([
      prisma.couponRedemption.count({ where: { couponId: coupon.id } }),
      prisma.couponRedemption.count({ where: { couponId: coupon.id, customerId: customerProfile.id } }),
    ]);
    const subtotalCents = pricedServices.reduce((sum, s) => sum + s.priceCents, 0);
    const result = applyCoupon(
      {
        type: coupon.type,
        value: coupon.value,
        maxUsesTotal: coupon.maxUsesTotal,
        currentUsesTotal: totalUses,
        maxUsesPerCustomer: coupon.maxUsesPerCustomer,
        currentUsesByThisCustomer: customerUses,
        minSpendCents: coupon.minSpendCents,
        validFrom: coupon.validFrom,
        validUntil: coupon.validUntil,
        active: coupon.active,
      },
      subtotalCents,
      start
    );
    if (!result.valid) {
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }
    appliedCoupon = { id: coupon.id, discountCents: result.discountCents };

    let remaining = result.discountCents;
    for (let i = pricedServices.length - 1; i >= 0 && remaining > 0; i--) {
      const reduceBy = Math.min(pricedServices[i].priceCents, remaining);
      pricedServices[i].priceCents -= reduceBy;
      remaining -= reduceBy;
    }
  }

  // Tax is calculated on the final discounted subtotal (after peak pricing,
  // membership, and coupon are already applied above) and included in what
  // the customer is shown/agrees to BEFORE confirming — not bolted on at
  // invoice time later, which was last round's known gap.
  const discountedSubtotalCents = pricedServices.reduce((sum, s) => sum + s.priceCents, 0);
  const taxCents = calculateTax(discountedSubtotalCents, salon.taxPercent);

  // Wallet credit (e.g. from a referral reward) is applied like a partial
  // payment made at booking time, capped by both the actual wallet balance
  // AND the bill total — never letting either go negative. Debited via
  // debitWallet's atomic conditional update, so two concurrent bookings
  // for the same customer can't both spend the same rupee.
  let walletAppliedCents = 0;
  if (useWalletCents > 0) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    const totalBeforeWallet = discountedSubtotalCents + priorityFeeCents + taxCents;
    walletAppliedCents = calculateWalletApplication(wallet?.balanceCents ?? 0, useWalletCents, totalBeforeWallet);
  }

  try {
    const appointment = await createAppointment({
      salonId,
      customerId: customerProfile.id,
      staffId,
      startTime: start,
      // endTime stored = full occupied window including buffer, so the
      // overlap check in createAppointment() correctly blocks the buffer
      // period from being booked by anyone else. serviceEnd (customer-facing)
      // is derived from this + service duration when displaying the booking.
      endTime: end,
      services: pricedServices,
      bookingType,
      priorityFeeCents,
      taxCents,
    });

    // Debit the wallet and record it as a real Payment row, same as
    // cash/UPI/online — so paidAmountCents stays derived from real Payment
    // rows everywhere, no special case for "money that came from wallet".
    // If debitWallet throws InsufficientWalletBalanceError (a genuine race
    // — balance changed between the check above and now), the booking
    // itself has ALREADY been created; we deliberately don't roll it back
    // over a wallet race, we just skip applying the discount and let the
    // customer pay the full amount another way. A stated, real edge case.
    if (walletAppliedCents > 0) {
      try {
        await debitWallet({
          userId,
          amountCents: walletAppliedCents,
          reason: `Applied to booking at ${salon.name}`,
          appointmentId: appointment.id,
        });
        await prisma.payment.create({
          data: {
            appointmentId: appointment.id,
            amountCents: walletAppliedCents,
            method: "WALLET",
            recordedById: userId,
          },
        });
        const agg = await prisma.payment.aggregate({
          where: { appointmentId: appointment.id },
          _sum: { amountCents: true },
        });
        const paidAmountCents = agg._sum.amountCents ?? 0;
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: {
            paidAmountCents,
            paymentStatus: paidAmountCents >= appointment.totalAmountCents ? "PAID" : "PARTIAL",
          },
        });
      } catch (err) {
        console.error("Wallet debit failed during booking (booking still succeeded):", err);
        walletAppliedCents = 0; // reflect reality in the response below
      }
    }

    // Record any free-included-visit benefit that was used. This runs
    // AFTER createAppointment's own transaction commits — it is a
    // best-effort follow-up, not part of the same atomic transaction, so
    // in the rare case this specific write fails, the booking itself still
    // succeeds but the benefit count could be off by one. Acceptable for
    // now; a fully atomic version would need createAppointment to accept
    // an optional "also do these writes" callback, which isn't built yet.
    if (activePurchase) {
      for (const [serviceId, application] of membershipApplications.entries()) {
        if (application.type === "FREE_INCLUDED_VISIT") {
          await prisma.membershipBenefitUsage.create({
            data: {
              membershipPurchaseId: activePurchase.id,
              serviceId,
              appointmentId: appointment.id,
            },
          });
        }
      }
    }

    if (appliedCoupon) {
      await prisma.couponRedemption
        .create({
          data: {
            couponId: appliedCoupon.id,
            customerId: customerProfile.id,
            appointmentId: appointment.id,
            discountCents: appliedCoupon.discountCents,
          },
        })
        .catch((err) => console.error("Coupon redemption record failed:", err));
    }

    // Best-effort confirmation notification — never blocks the booking response.
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const contact = user?.phone ?? user?.email;
    if (contact && user) {
      const text = bookingConfirmation({
        customerName: user.name ?? "there",
        salonName: salon.name,
        serviceName: services.map((s) => s.name).join(", "),
        dateTime: start.toLocaleString(),
        priceRupees:
          pricedServices.reduce((sum, s) => sum + s.priceCents, 0) / 100 +
          priorityFeeCents / 100 +
          taxCents / 100,
      });
      getNotificationProvider()
        .send({
          to: contact,
          channel: user.phone ? "WHATSAPP" : "EMAIL",
          templateKey: "bookingConfirmation",
          variables: {},
          renderedText: text,
        })
        .catch((err) => console.error("Notification send failed:", err));
    }

    return NextResponse.json({ appointment, walletAppliedCents }, { status: 201 });
  } catch (err) {
    if (err instanceof SlotUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Could not create booking" }, { status: 500 });
  }
});