import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

export class SlotUnavailableError extends Error {
  constructor() {
    super("This slot is no longer available. Please choose another time.");
  }
}

interface CreateAppointmentParams {
  salonId: string;
  customerId: string;
  staffId: string;
  startTime: Date;
  endTime: Date; // service end time (buffer handled separately by caller's slot calc)
  services: { serviceId: string; priceCents: number; durationMinutes: number }[];
  bookingType: "NORMAL" | "PRIORITY";
  priorityFeeCents: number;
  taxCents: number;
}

/**
 * Two customers hitting "book" for the same staff+time at the same instant
 * (spec section 72, test case 10) is handled two ways simultaneously:
 *
 * 1. DB-level: Appointment has @@unique([staffId, startTime]) — the second
 *    insert throws a unique constraint violation (P2002) even under full
 *    concurrency, because Postgres enforces it at the row level.
 * 2. App-level: we re-check for ANY overlapping appointment for this staff
 *    member inside the same transaction (not just exact start-time matches),
 *    since two services of different durations can still overlap without
 *    sharing an identical start time.
 */
export async function createAppointment(params: CreateAppointmentParams) {
  const { salonId, customerId, staffId, startTime, endTime, services, bookingType, priorityFeeCents, taxCents } =
    params;

  try {
    return await prisma.$transaction(async (tx) => {
      const overlapping = await tx.appointment.findFirst({
        where: {
          staffId,
          status: { in: ["PENDING", "CONFIRMED"] },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      });

      if (overlapping) {
        throw new SlotUnavailableError();
      }

      const totalAmountCents =
        services.reduce((sum, s) => sum + s.priceCents, 0) + priorityFeeCents + taxCents;

      const appointment = await tx.appointment.create({
        data: {
          salonId,
          customerId,
          staffId,
          startTime,
          endTime,
          bookingType,
          priorityFeeCents,
          taxCents,
          totalAmountCents,
          status: "CONFIRMED",
          services: {
            create: services.map((s) => ({
              serviceId: s.serviceId,
              priceCents: s.priceCents,
              durationMinutes: s.durationMinutes,
            })),
          },
        },
        include: { services: true },
      });

      return appointment;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Unique constraint on [staffId, startTime] fired — someone else won the race
      throw new SlotUnavailableError();
    }
    throw err;
  }
}
