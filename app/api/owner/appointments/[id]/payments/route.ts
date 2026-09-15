import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/lib/permissions";
import { withAuthErrors } from "@/lib/api/withAuthErrors";
import { logAudit } from "@/lib/audit/logAudit";

const bodySchema = z.object({
  amountCents: z.number().int().positive(),
  method: z.enum(["CASH", "UPI"]), // ONLINE payments only ever get created by the webhook, never this route
});

async function assertStaffCanBill(userId: string, role: string, salonId: string) {
  if (role === "ADMIN") return true;
  const salon = await prisma.salon.findUnique({ where: { id: salonId } });
  if (salon?.ownerId === userId) return true;
  const staffLink = await prisma.staff.findFirst({ where: { userId, salonId, active: true } });
  return !!staffLink;
}

export const POST = withAuthErrors(async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireSession();
  const userId = (session.user as any).id as string;
  const role = (session.user as any).role as string;

  const appointment = await prisma.appointment.findUnique({ where: { id: params.id } });
  if (!appointment) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const allowed = await assertStaffCanBill(userId, role, appointment.salonId);
  if (!allowed) return NextResponse.json({ error: "You can't bill this appointment" }, { status: 403 });

  const json = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { amountCents, method } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        appointmentId: appointment.id,
        amountCents,
        method,
        recordedById: userId,
      },
    });

    // paidAmountCents is ALWAYS derived by summing real payment rows —
    // never incremented directly — so it can never drift from the audit trail.
    const agg = await tx.payment.aggregate({
      where: { appointmentId: appointment.id },
      _sum: { amountCents: true },
    });
    const paidAmountCents = agg._sum.amountCents ?? 0;

    const paymentStatus =
      paidAmountCents <= 0
        ? "UNPAID"
        : paidAmountCents >= appointment.totalAmountCents
          ? "PAID"
          : "PARTIAL";

    return tx.appointment.update({
      where: { id: appointment.id },
      data: { paidAmountCents, paymentStatus },
    });
  });

  await logAudit({
    actorId: userId,
    action: "PAYMENT_RECORDED",
    entity: "Appointment",
    entityId: appointment.id,
    metadata: { amountCents, method },
  });

  return NextResponse.json({
    appointment: result,
    dueAmountCents: Math.max(result.totalAmountCents - result.paidAmountCents, 0),
  });
});
