import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSalonAccess } from "@/lib/permissions";
import { withAuthErrors } from "@/lib/api/withAuthErrors";
import { logAudit } from "@/lib/audit/logAudit";

const bodySchema = z.object({
  code: z.string().min(3).max(30),
  type: z.enum(["PERCENTAGE", "FIXED"]),
  value: z.number().int().positive(),
  maxUsesTotal: z.number().int().positive().nullable().optional(),
  maxUsesPerCustomer: z.number().int().positive().default(1),
  minSpendCents: z.number().int().min(0).default(0),
  validUntil: z.string().datetime().nullable().optional(),
});

export const GET = withAuthErrors(async function GET(
  req: NextRequest,
  { params }: { params: { salonId: string } }
) {
  await requireSalonAccess(params.salonId);
  const coupons = await prisma.coupon.findMany({
    where: { salonId: params.salonId },
    orderBy: { validFrom: "desc" },
  });
  return NextResponse.json({ coupons });
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
  if (parsed.data.type === "PERCENTAGE" && parsed.data.value > 100) {
    return NextResponse.json({ error: "Percentage value can't exceed 100" }, { status: 400 });
  }

  const coupon = await prisma.coupon.create({
    data: {
      salonId: params.salonId,
      code: parsed.data.code.toUpperCase(),
      type: parsed.data.type,
      value: parsed.data.value,
      maxUsesTotal: parsed.data.maxUsesTotal ?? null,
      maxUsesPerCustomer: parsed.data.maxUsesPerCustomer,
      minSpendCents: parsed.data.minSpendCents,
      validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : null,
    },
  });

  await logAudit({
    actorId: (session.user as any).id,
    action: "COUPON_CREATED",
    entity: "Coupon",
    entityId: coupon.id,
  });

  return NextResponse.json({ coupon }, { status: 201 });
});
