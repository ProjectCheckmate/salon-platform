import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/lib/permissions";
import { withAuthErrors } from "@/lib/api/withAuthErrors";
import { logAudit } from "@/lib/audit/logAudit";

export const POST = withAuthErrors(async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireSession();
  const userId = (session.user as any).id as string;

  const membership = await prisma.membership.findUnique({ where: { id: params.id } });
  if (!membership || !membership.active) {
    return NextResponse.json({ error: "Membership package not found" }, { status: 404 });
  }

  const customer = await prisma.customerProfile.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  // NOTE: this creates the purchase record and starts the validity clock.
  // Actual payment collection for the membership price itself goes through
  // the same payment-provider abstraction as bookings once that's wired in
  // here — for now this records intent-to-purchase; charging happens
  // out-of-band via the owner's cash/UPI recording tools, same as a booking.
  const purchase = await prisma.membershipPurchase.create({
    data: {
      membershipId: membership.id,
      customerId: customer.id,
      expiresAt: new Date(Date.now() + membership.validityDays * 24 * 60 * 60 * 1000),
    },
  });

  await logAudit({
    actorId: userId,
    action: "MEMBERSHIP_PURCHASED",
    entity: "MembershipPurchase",
    entityId: purchase.id,
    metadata: { membershipId: membership.id, priceCents: membership.priceCents },
  });

  return NextResponse.json({ purchase }, { status: 201 });
});
