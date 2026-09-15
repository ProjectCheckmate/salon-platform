import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSalonAccess } from "@/lib/permissions";
import { withAuthErrors } from "@/lib/api/withAuthErrors";
import { getNotificationProvider } from "@/lib/notifications/notificationProvider";
import { rebookingReminder } from "@/lib/notifications/templates";
import { logAudit } from "@/lib/audit/logAudit";

const bodySchema = z.object({
  customerIds: z.array(z.string()).min(1).max(100),
  daysSinceLastVisitByCustomer: z.record(z.string(), z.number()),
});

/**
 * This is the "Send Campaign" action from the Money Opportunity dashboard
 * (spec section 40's [Send Campaign] button). It only ever sends to
 * customers the owner explicitly selected — never auto-sends on its own,
 * matching spec section 30: "Owner can review before sending." Consent is
 * still checked per-customer here (not just left to the caller) so this
 * endpoint can never be used to route around notificationsOptedIn.
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

  const salon = await prisma.salon.findUnique({ where: { id: params.salonId } });
  if (!salon) return NextResponse.json({ error: "Salon not found" }, { status: 404 });

  const customers = await prisma.customerProfile.findMany({
    where: { id: { in: parsed.data.customerIds }, notificationsOptedIn: true },
    include: { user: true },
  });

  const provider = getNotificationProvider();
  let sentCount = 0;

  for (const c of customers) {
    const contact = c.user.phone ?? c.user.email;
    if (!contact) continue;
    const daysSince = parsed.data.daysSinceLastVisitByCustomer[c.id] ?? 0;
    const text = rebookingReminder({
      customerName: c.user.name ?? "there",
      salonName: salon.name,
      daysSinceLastVisit: daysSince,
    });
    await provider.send({
      to: contact,
      channel: c.user.phone ? "WHATSAPP" : "EMAIL",
      templateKey: "rebookingReminder",
      variables: {},
      renderedText: text,
    });
    sentCount++;
  }

  await logAudit({
    actorId: (session.user as any).id,
    action: "CAMPAIGN_SENT",
    entity: "Salon",
    entityId: params.salonId,
    metadata: { requestedCount: parsed.data.customerIds.length, sentCount },
  });

  return NextResponse.json({ sentCount, skippedCount: parsed.data.customerIds.length - sentCount });
});
