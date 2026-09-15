import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSalonAccess } from "@/lib/permissions";
import { withAuthErrors } from "@/lib/api/withAuthErrors";
import { logAudit } from "@/lib/audit/logAudit";

const dayHoursSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  isOpen: z.boolean(),
  openTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
});
const bodySchema = z.object({ days: z.array(dayHoursSchema).length(7) });

export const GET = withAuthErrors(async function GET(
  req: NextRequest,
  { params }: { params: { salonId: string } }
) {
  await requireSalonAccess(params.salonId);
  const hours = await prisma.salonWorkingHours.findMany({
    where: { salonId: params.salonId },
    orderBy: { weekday: "asc" },
  });
  return NextResponse.json({ hours });
});

// PUT replaces the full week in one call — simpler for the UI than 7 PATCHes,
// and avoids partial-week states being briefly inconsistent.
export const PUT = withAuthErrors(async function PUT(
  req: NextRequest,
  { params }: { params: { salonId: string } }
) {
  const session = await requireSalonAccess(params.salonId);
  const json = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.$transaction(
    parsed.data.days.map((d) =>
      prisma.salonWorkingHours.upsert({
        where: { salonId_weekday: { salonId: params.salonId, weekday: d.weekday } },
        update: { isOpen: d.isOpen, openTime: d.openTime, closeTime: d.closeTime },
        create: { salonId: params.salonId, ...d },
      })
    )
  );

  await logAudit({
    actorId: (session.user as any).id,
    action: "SALON_HOURS_UPDATED",
    entity: "Salon",
    entityId: params.salonId,
  });

  const hours = await prisma.salonWorkingHours.findMany({
    where: { salonId: params.salonId },
    orderBy: { weekday: "asc" },
  });
  return NextResponse.json({ hours });
});
