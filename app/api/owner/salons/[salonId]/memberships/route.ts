import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSalonAccess } from "@/lib/permissions";
import { withAuthErrors } from "@/lib/api/withAuthErrors";
import { logAudit } from "@/lib/audit/logAudit";

const bodySchema = z.object({
  name: z.string().min(2).max(120),
  priceCents: z.number().int().positive(),
  validityDays: z.number().int().positive().default(365),
  discountPercent: z.number().int().min(0).max(100).default(0),
  benefits: z.array(z.object({ serviceId: z.string(), includedCount: z.number().int().positive() })).default([]),
});

export const GET = withAuthErrors(async function GET(
  req: NextRequest,
  { params }: { params: { salonId: string } }
) {
  // Public-ish read: anyone can see a salon's membership offerings on its
  // page, so this only requires the salon to exist and be approved rather
  // than requiring salon access — unlike every other owner-scoped route here.
  const memberships = await prisma.membership.findMany({
    where: { salonId: params.salonId, active: true },
    include: { benefits: { include: { service: true } } },
  });
  return NextResponse.json({ memberships });
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

  // Confirm every referenced service actually belongs to this salon —
  // otherwise an owner could bundle another salon's service into their package.
  if (parsed.data.benefits.length > 0) {
    const services = await prisma.service.findMany({
      where: { id: { in: parsed.data.benefits.map((b) => b.serviceId) }, salonId: params.salonId },
    });
    if (services.length !== parsed.data.benefits.length) {
      return NextResponse.json({ error: "One or more services don't belong to this salon" }, { status: 400 });
    }
  }

  const membership = await prisma.membership.create({
    data: {
      salonId: params.salonId,
      name: parsed.data.name,
      priceCents: parsed.data.priceCents,
      validityDays: parsed.data.validityDays,
      discountPercent: parsed.data.discountPercent,
      benefits: { create: parsed.data.benefits },
    },
    include: { benefits: true },
  });

  await logAudit({
    actorId: (session.user as any).id,
    action: "MEMBERSHIP_CREATED",
    entity: "Membership",
    entityId: membership.id,
  });

  return NextResponse.json({ membership }, { status: 201 });
});
