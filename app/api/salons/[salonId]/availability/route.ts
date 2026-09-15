import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { calculateAvailableSlots } from "@/lib/booking-engine/calculateAvailableSlots";
import { calculatePrice } from "@/lib/pricing/calculatePrice";
import { calculateTax } from "@/lib/tax/calculateTax";

// GET /api/salons/[salonId]/availability?serviceId=...&staffId=...&date=2026-09-05
export async function GET(req: NextRequest, { params }: { params: { salonId: string } }) {
  const { searchParams } = new URL(req.url);
  const serviceId = searchParams.get("serviceId");
  const staffId = searchParams.get("staffId");
  const dateStr = searchParams.get("date"); // "YYYY-MM-DD"

  if (!serviceId || !staffId || !dateStr) {
    return NextResponse.json(
      { error: "serviceId, staffId and date are required" },
      { status: 400 }
    );
  }

  const salon = await prisma.salon.findUnique({ where: { id: params.salonId } });
  if (!salon || salon.status !== "APPROVED") {
    return NextResponse.json({ error: "Salon not found" }, { status: 404 });
  }

  const service = await prisma.service.findFirst({
    where: { id: serviceId, salonId: salon.id, active: true },
  });
  if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 });

  const date = new Date(`${dateStr}T00:00:00.000Z`);
  const weekday = date.getUTCDay();
  const dayEnd = new Date(date.getTime() + 24 * 60 * 60 * 1000);

  const [salonHours, staffHours, staffBreaks, existingAppointments, holiday, peakWindows] = await Promise.all([
    prisma.salonWorkingHours.findUnique({ where: { salonId_weekday: { salonId: salon.id, weekday } } }),
    prisma.staffWorkingHours.findUnique({ where: { staffId_weekday: { staffId, weekday } } }),
    prisma.staffBreak.findMany({ where: { staffId, weekday } }),
    prisma.appointment.findMany({
      where: {
        staffId,
        status: { in: ["PENDING", "CONFIRMED"] },
        startTime: { gte: date, lt: dayEnd },
      },
      select: { startTime: true, endTime: true },
    }),
    prisma.holiday.findFirst({
      where: {
        salonId: salon.id,
        date: { gte: date, lt: dayEnd },
        OR: [{ staffId: null }, { staffId }],
      },
    }),
    prisma.peakHourWindow.findMany({ where: { salonId: salon.id } }),
  ]);

  const slots = calculateAvailableSlots({
    date,
    salonHours: salonHours ?? { isOpen: false, openTime: null, closeTime: null },
    staffHours: staffHours ?? { isWorking: false, startTime: null, endTime: null },
    staffBreaks,
    existingAppointments: existingAppointments.map((a) => ({ start: a.startTime, end: a.endTime })),
    isHoliday: !!holiday,
    serviceDurationMinutes: service.durationMinutes,
    bufferMinutes: service.bufferMinutes,
    slotIntervalMinutes: 30,
    timezoneOffsetMinutes: 330, // TODO: make per-salon once multi-region is needed
    now: new Date(),
  });

  return NextResponse.json({
    salonId: salon.id,
    serviceId: service.id,
    date: dateStr,
    slots: slots.map((s) => {
      const normalPrice = calculatePrice({
        basePriceCents: service.priceCents,
        peakPriceCents: service.peakPriceCents,
        slotStart: s.start,
        timezoneOffsetMinutes: 330,
        peakWindows,
        bookingType: "NORMAL",
        priorityFeeCents: 0,
      });
      const priorityPrice = service.priorityAllowed
        ? calculatePrice({
            basePriceCents: service.priceCents,
            peakPriceCents: service.peakPriceCents,
            slotStart: s.start,
            timezoneOffsetMinutes: 330,
            peakWindows,
            bookingType: "PRIORITY",
            priorityFeeCents: 15000, // TODO: pull from salon settings once configurable
          })
        : null;

      // Tax shown here is calculated on the pre-membership/coupon price,
      // since those are only known once a specific logged-in customer
      // actually books — this browse-time figure is the honest "at least
      // this much" price; the final booking price (with any membership/
      // coupon discount applied first, then tax on THAT) may be lower and
      // is recalculated for real in POST /api/bookings.
      const normalTaxCents = calculateTax(normalPrice.totalCents, salon.taxPercent);
      const priorityTaxCents = priorityPrice ? calculateTax(priorityPrice.totalCents, salon.taxPercent) : 0;

      return {
        start: s.start.toISOString(),
        end: s.end.toISOString(),
        isPeak: normalPrice.isPeak,
        normalPriceCents: normalPrice.totalCents + normalTaxCents,
        priorityPriceCents: priorityPrice ? priorityPrice.totalCents + priorityTaxCents : null,
      };
    }),
  });
}
