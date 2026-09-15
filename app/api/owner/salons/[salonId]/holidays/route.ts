import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSalonAccess } from "@/lib/permissions";
import { withAuthErrors } from "@/lib/api/withAuthErrors";
import { logAudit } from "@/lib/audit/logAudit";

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // "YYYY-MM-DD"
  staffId: z.string().nullable().optional(), // null/omitted = whole-salon holiday
  reason: z.string().optional(),
});

export const GET = withAuthErrors(async function GET(
  req: NextRequest,
  { params }: { params: { salonId: string } }
) {
  await requireSalonAccess(params.salonId);
  const holidays = await prisma.holiday.findMany({
    where: { salonId: params.salonId },
    orderBy: { date: "asc" },
  });
  return NextResponse.json({ holidays });
});

export const POST = withAuthErrors(async function POST(
  req: NextRequest,
  { params }: { params: { salonId: string } }
) {
  const session = await requireSalonAccess(params.salonId);
  const json = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // If a staffId is given, confirm it actually belongs to THIS salon —
  // otherwise an owner could mark leave for another salon's staff member.
  if (parsed.data.staffId) {
    const staff = await prisma.staff.findUnique({ where: { id: parsed.data.staffId } });
    if (!staff || staff.salonId !== params.salonId) {
      return NextResponse.json({ error: "Staff member not found in this salon" }, { status: 400 });
    }
  }

  const holiday = await prisma.holiday.create({
    data: {
      salonId: params.salonId,
      staffId: parsed.data.staffId ?? null,
      date: new Date(`${parsed.data.date}T00:00:00.000Z`),
      reason: parsed.data.reason,
    },
  });

  await logAudit({
    actorId: (session.user as any).id,
    action: parsed.data.staffId ? "STAFF_LEAVE_ADDED" : "SALON_HOLIDAY_ADDED",
    entity: "Holiday",
    entityId: holiday.id,
  });

  return NextResponse.json({ holiday }, { status: 201 });
});
