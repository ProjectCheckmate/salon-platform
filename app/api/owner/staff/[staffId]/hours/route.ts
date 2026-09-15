import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSalonAccess } from "@/lib/permissions";
import { withAuthErrors } from "@/lib/api/withAuthErrors";

const dayHoursSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  isWorking: z.boolean(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
});
const breakSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});
const bodySchema = z.object({
  days: z.array(dayHoursSchema).length(7),
  breaks: z.array(breakSchema).default([]),
});

async function assertStaffAccessible(staffId: string) {
  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  return staff;
}

export const PUT = withAuthErrors(async function PUT(
  req: NextRequest,
  { params }: { params: { staffId: string } }
) {
  const staff = await assertStaffAccessible(params.staffId);
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  // Confirms the caller has access to THIS staff member's salon —
  // prevents an owner from editing a staff member at another salon
  // even if they somehow guessed the staffId.
  await requireSalonAccess(staff.salonId);

  const json = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.$transaction([
    ...parsed.data.days.map((d) =>
      prisma.staffWorkingHours.upsert({
        where: { staffId_weekday: { staffId: params.staffId, weekday: d.weekday } },
        update: { isWorking: d.isWorking, startTime: d.startTime, endTime: d.endTime },
        create: { staffId: params.staffId, ...d },
      })
    ),
    prisma.staffBreak.deleteMany({ where: { staffId: params.staffId } }),
    ...parsed.data.breaks.map((b) =>
      prisma.staffBreak.create({ data: { staffId: params.staffId, ...b } })
    ),
  ]);

  const [hours, breaks] = await Promise.all([
    prisma.staffWorkingHours.findMany({ where: { staffId: params.staffId }, orderBy: { weekday: "asc" } }),
    prisma.staffBreak.findMany({ where: { staffId: params.staffId } }),
  ]);

  return NextResponse.json({ hours, breaks });
});
