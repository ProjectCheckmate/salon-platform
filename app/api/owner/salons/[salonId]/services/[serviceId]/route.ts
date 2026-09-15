import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSalonAccess } from "@/lib/permissions";
import { withAuthErrors } from "@/lib/api/withAuthErrors";
import { logAudit } from "@/lib/audit/logAudit";

const patchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  priceCents: z.number().int().positive().optional(),
  durationMinutes: z.number().int().positive().optional(),
  bufferMinutes: z.number().int().min(0).optional(),
  peakPriceCents: z.number().int().positive().nullable().optional(),
  priorityAllowed: z.boolean().optional(),
  active: z.boolean().optional(),
});

async function assertServiceBelongsToSalon(serviceId: string, salonId: string) {
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || service.salonId !== salonId) {
    return null;
  }
  return service;
}

export const PATCH = withAuthErrors(async function PATCH(
  req: NextRequest,
  { params }: { params: { salonId: string; serviceId: string } }
) {
  const session = await requireSalonAccess(params.salonId);

  const existing = await assertServiceBelongsToSalon(params.serviceId, params.salonId);
  if (!existing) return NextResponse.json({ error: "Service not found" }, { status: 404 });

  const json = await req.json();
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const service = await prisma.service.update({
    where: { id: params.serviceId },
    data: parsed.data,
  });

  await logAudit({
    actorId: (session.user as any).id,
    action: "SERVICE_UPDATED",
    entity: "Service",
    entityId: service.id,
    metadata: parsed.data,
  });

  return NextResponse.json({ service });
});

export const DELETE = withAuthErrors(async function DELETE(
  req: NextRequest,
  { params }: { params: { salonId: string; serviceId: string } }
) {
  const session = await requireSalonAccess(params.salonId);

  const existing = await assertServiceBelongsToSalon(params.serviceId, params.salonId);
  if (!existing) return NextResponse.json({ error: "Service not found" }, { status: 404 });

  // Soft-delete: deactivate rather than hard-delete, so historical
  // appointments/invoices that reference this service stay intact.
  const service = await prisma.service.update({
    where: { id: params.serviceId },
    data: { active: false },
  });

  await logAudit({
    actorId: (session.user as any).id,
    action: "SERVICE_DEACTIVATED",
    entity: "Service",
    entityId: service.id,
  });

  return NextResponse.json({ service });
});
