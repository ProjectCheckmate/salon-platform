import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSalonAccess } from "@/lib/permissions";
import { withAuthErrors } from "@/lib/api/withAuthErrors";
import { logAudit } from "@/lib/audit/logAudit";

const bodySchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
});

export const GET = withAuthErrors(async function GET(
  req: NextRequest,
  { params }: { params: { salonId: string } }
) {
  await requireSalonAccess(params.salonId);
  const staff = await prisma.staff.findMany({
    where: { salonId: params.salonId, active: true },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json({ staff });
});

/**
 * Adding staff by email either links an existing user account or creates a
 * placeholder STAFF-role account for them (no password set — they complete
 * setup via a password-reset-style invite link in a later phase's email flow).
 * This route only establishes the salon<->user link; it never touches
 * another salon's staff records because requireSalonAccess scopes it.
 */
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
  const { email, name } = parsed.data;

  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase().trim() },
    update: {},
    create: { email: email.toLowerCase().trim(), name, role: "STAFF" },
  });

  const staff = await prisma.staff.upsert({
    where: { userId_salonId: { userId: user.id, salonId: params.salonId } },
    update: { active: true },
    create: { userId: user.id, salonId: params.salonId },
  });

  await logAudit({
    actorId: (session.user as any).id,
    action: "STAFF_ADDED",
    entity: "Staff",
    entityId: staff.id,
    metadata: { salonId: params.salonId, staffEmail: email },
  });

  return NextResponse.json({ staff }, { status: 201 });
});
