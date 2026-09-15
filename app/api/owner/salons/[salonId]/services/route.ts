import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSalonAccess } from "@/lib/permissions";
import { withAuthErrors } from "@/lib/api/withAuthErrors";
import { logAudit } from "@/lib/audit/logAudit";

const bodySchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  priceCents: z.number().int().positive(),
  durationMinutes: z.number().int().positive(),
  bufferMinutes: z.number().int().min(0).default(0),
  peakPriceCents: z.number().int().positive().optional(),
  priorityAllowed: z.boolean().default(false),
});

export const GET = withAuthErrors(async function GET(
  req: NextRequest,
  { params }: { params: { salonId: string } }
) {
  const session = await requireSalonAccess(params.salonId);
  const services = await prisma.service.findMany({
    where: { salonId: params.salonId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ services });
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

  const service = await prisma.service.create({
    data: { ...parsed.data, salonId: params.salonId },
  });

  await logAudit({
    actorId: (session.user as any).id,
    action: "SERVICE_CREATED",
    entity: "Service",
    entityId: service.id,
    metadata: { salonId: params.salonId },
  });

  return NextResponse.json({ service }, { status: 201 });
});
