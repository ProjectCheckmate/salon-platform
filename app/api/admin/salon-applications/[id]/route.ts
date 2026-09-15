import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/permissions";
import { logAudit } from "@/lib/audit/logAudit";
import { withAuthErrors } from "@/lib/api/withAuthErrors";

const bodySchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  notes: z.string().optional(),
});

// PATCH /api/admin/salon-applications/[id] { decision, notes }
export const PATCH = withAuthErrors(async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireRole("ADMIN");
  const adminId = (session.user as any).id as string;

  const json = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { decision, notes } = parsed.data;

  const application = await prisma.salonApplication.findUnique({
    where: { id: params.id },
    include: { salon: true },
  });
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (application.status !== "PENDING") {
    return NextResponse.json({ error: "Application already reviewed" }, { status: 409 });
  }

  const newStatus = decision === "APPROVE" ? "APPROVED" : "REJECTED";

  const [updatedApp] = await prisma.$transaction([
    prisma.salonApplication.update({
      where: { id: application.id },
      data: { status: newStatus, notes, reviewedAt: new Date(), reviewedBy: adminId },
    }),
    prisma.salon.update({
      where: { id: application.salonId },
      data: { status: newStatus },
    }),
  ]);

  await logAudit({
    actorId: adminId,
    action: decision === "APPROVE" ? "SALON_APPROVED" : "SALON_REJECTED",
    entity: "Salon",
    entityId: application.salonId,
    metadata: { notes },
  });

  return NextResponse.json({ application: updatedApp });
});
