import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/lib/permissions";
import { withAuthErrors } from "@/lib/api/withAuthErrors";
import { logAudit } from "@/lib/audit/logAudit";

const bodySchema = z.object({ newStartTime: z.string().datetime() });

export const POST = withAuthErrors(async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireSession();
  const userId = (session.user as any).id as string;

  const json = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: params.id },
    include: { customer: true, services: true },
  });
  if (!appointment) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (appointment.customer.userId !== userId) {
    return NextResponse.json({ error: "You can't reschedule this booking" }, { status: 403 });
  }
  if (appointment.status !== "CONFIRMED" && appointment.status !== "PENDING") {
    return NextResponse.json({ error: "This booking can no longer be rescheduled" }, { status: 409 });
  }

  const occupiedMs = appointment.endTime.getTime() - appointment.startTime.getTime();
  const newStart = new Date(parsed.data.newStartTime);
  const newEnd = new Date(newStart.getTime() + occupiedMs);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Same overlap guard as createAppointment.ts, excluding this
      // appointment's own current row from the check.
      const overlapping = await tx.appointment.findFirst({
        where: {
          staffId: appointment.staffId,
          id: { not: appointment.id },
          status: { in: ["PENDING", "CONFIRMED"] },
          startTime: { lt: newEnd },
          endTime: { gt: newStart },
        },
      });
      if (overlapping) {
        throw new Error("SLOT_TAKEN");
      }

      return tx.appointment.update({
        where: { id: appointment.id },
        data: { startTime: newStart, endTime: newEnd },
      });
    });

    await logAudit({
      actorId: userId,
      action: "APPOINTMENT_RESCHEDULED",
      entity: "Appointment",
      entityId: appointment.id,
      metadata: { from: appointment.startTime, to: newStart },
    });

    return NextResponse.json({ appointment: updated });
  } catch (err) {
    if (err instanceof Error && err.message === "SLOT_TAKEN") {
      return NextResponse.json({ error: "That new time is no longer available" }, { status: 409 });
    }
    if (err instanceof Error && (err as any).code === "P2002") {
      return NextResponse.json({ error: "That new time is no longer available" }, { status: 409 });
    }
    throw err;
  }
});
