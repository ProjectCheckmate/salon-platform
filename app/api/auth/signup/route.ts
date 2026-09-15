import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { logAudit } from "@/lib/audit/logAudit";

const bodySchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().min(6).max(20).optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["CUSTOMER", "OWNER"]).default("CUSTOMER"),
  referralCode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const json = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name, email, phone, password, role, referralCode } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase().trim(),
      phone,
      passwordHash,
      role,
      ...(role === "CUSTOMER" ? { customer: { create: {} } } : {}),
    },
  });

  await logAudit({
    actorId: user.id,
    action: "USER_SIGNED_UP",
    entity: "User",
    entityId: user.id,
    metadata: { role },
  });

  if (referralCode && role === "CUSTOMER") {
    try {
      const candidates = await prisma.user.findMany({
        where: { id: { startsWith: referralCode.slice(0, 8).toLowerCase() } },
      });
      const matchedReferrer = candidates.find(
        (u) => u.id.slice(0, 8).toUpperCase() === referralCode.toUpperCase() && u.id !== user.id
      );
      if (matchedReferrer) {
        await prisma.referral.create({
          data: {
            referrerId: matchedReferrer.id,
            referredUserId: user.id,
            code: referralCode,
            rewardCents: 10000,
          },
        });
      }
    } catch (err) {
      console.error("Referral linking at signup failed (non-blocking):", err);
    }
  }

  return NextResponse.json({ success: true, email: user.email }, { status: 201 });
}
