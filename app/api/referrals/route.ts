import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/lib/permissions";
import { withAuthErrors } from "@/lib/api/withAuthErrors";
import { isSelfReferral } from "@/lib/referrals/referralRules";
import { logAudit } from "@/lib/audit/logAudit";

const REWARD_CENTS = 10000; // ₹100 each side, per spec section 37's example

// GET -> this customer's own referral code (their user id, short-form) + list of referrals they've sent
export const GET = withAuthErrors(async function GET() {
  const session = await requireSession();
  const userId = (session.user as any).id as string;

  const referrals = await prisma.referral.findMany({
    where: { referrerId: userId },
    include: { referredUser: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    code: userId.slice(0, 8).toUpperCase(),
    referrals: referrals.map((r) => ({
      id: r.id,
      referredName: r.referredUser.name ?? "New customer",
      status: r.status,
      rewardCents: r.rewardCents,
    })),
  });
});

const bodySchema = z.object({ referralCode: z.string() });

/**
 * Called right after a NEW user signs up, from the signup flow, with the
 * code they entered. Creates the PENDING referral record — the actual
 * reward is only granted later, when their first booking qualifies (see
 * the completion-linked redemption logic, applied from the appointment
 * completion route).
 */
export const POST = withAuthErrors(async function POST(req: NextRequest) {
  const session = await requireSession();
  const referredUserId = (session.user as any).id as string;

  const json = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Referral codes are the first 8 chars of the referrer's user id
  // (uppercased) — look up by prefix match against the real id.
  const candidates = await prisma.user.findMany({
    where: { id: { startsWith: parsed.data.referralCode.slice(0, 8).toLowerCase() } },
  });
  const matchedReferrer = candidates.find(
    (u) => u.id.slice(0, 8).toUpperCase() === parsed.data.referralCode.toUpperCase()
  );

  if (!matchedReferrer) {
    return NextResponse.json({ error: "Invalid referral code" }, { status: 400 });
  }
  if (matchedReferrer.id === referredUserId) {
    return NextResponse.json({ error: "You can't refer yourself" }, { status: 400 });
  }

  const referredUser = await prisma.user.findUnique({ where: { id: referredUserId } });
  if (
    !referredUser ||
    isSelfReferral({
      referrerEmail: matchedReferrer.email,
      referrerPhone: matchedReferrer.phone,
      referredEmail: referredUser.email,
      referredPhone: referredUser.phone,
    })
  ) {
    return NextResponse.json({ error: "You can't refer yourself" }, { status: 400 });
  }

  const existing = await prisma.referral.findUnique({ where: { referredUserId } });
  if (existing) {
    return NextResponse.json({ error: "A referral has already been recorded for this account" }, { status: 409 });
  }

  const referral = await prisma.referral.create({
    data: {
      referrerId: matchedReferrer.id,
      referredUserId,
      code: parsed.data.referralCode,
      rewardCents: REWARD_CENTS,
      status: "PENDING",
    },
  });

  await logAudit({
    actorId: referredUserId,
    action: "REFERRAL_CREATED",
    entity: "Referral",
    entityId: referral.id,
  });

  return NextResponse.json({ referral }, { status: 201 });
});
