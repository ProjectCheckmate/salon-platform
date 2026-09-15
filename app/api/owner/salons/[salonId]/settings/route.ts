import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSalonAccess } from "@/lib/permissions";
import { withAuthErrors } from "@/lib/api/withAuthErrors";
import { logAudit } from "@/lib/audit/logAudit";

const bodySchema = z.object({
  taxPercent: z.number().int().min(0).max(100),
});

export const GET = withAuthErrors(async function GET(
  req: NextRequest,
  { params }: { params: { salonId: string } }
) {
  await requireSalonAccess(params.salonId);
  const salon = await prisma.salon.findUnique({
    where: { id: params.salonId },
    select: { taxPercent: true },
  });
  return NextResponse.json({ settings: salon });
});

export const PATCH = withAuthErrors(async function PATCH(
  req: NextRequest,
  { params }: { params: { salonId: string } }
) {
  const session = await requireSalonAccess(params.salonId);
  const json = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const salon = await prisma.salon.update({
    where: { id: params.salonId },
    data: { taxPercent: parsed.data.taxPercent },
  });

  await logAudit({
    actorId: (session.user as any).id,
    action: "SALON_SETTINGS_UPDATED",
    entity: "Salon",
    entityId: salon.id,
    metadata: { taxPercent: parsed.data.taxPercent },
  });

  return NextResponse.json({ settings: { taxPercent: salon.taxPercent } });
});
