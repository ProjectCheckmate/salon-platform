import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/lib/permissions";
import { withAuthErrors } from "@/lib/api/withAuthErrors";

const bodySchema = z.object({ salonId: z.string() });

async function getOrCreateCustomerProfile(userId: string) {
  return prisma.customerProfile.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export const GET = withAuthErrors(async function GET() {
  const session = await requireSession();
  const userId = (session.user as any).id as string;
  const customer = await getOrCreateCustomerProfile(userId);

  const favourites = await prisma.favourite.findMany({
    where: { customerId: customer.id },
    include: { salon: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ favourites });
});

export const POST = withAuthErrors(async function POST(req: NextRequest) {
  const session = await requireSession();
  const userId = (session.user as any).id as string;

  const json = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const salon = await prisma.salon.findUnique({ where: { id: parsed.data.salonId } });
  if (!salon || salon.status !== "APPROVED") {
    return NextResponse.json({ error: "Salon not found" }, { status: 404 });
  }

  const customer = await getOrCreateCustomerProfile(userId);
  const favourite = await prisma.favourite.upsert({
    where: { customerId_salonId: { customerId: customer.id, salonId: salon.id } },
    update: {},
    create: { customerId: customer.id, salonId: salon.id },
  });

  return NextResponse.json({ favourite }, { status: 201 });
});

export const DELETE = withAuthErrors(async function DELETE(req: NextRequest) {
  const session = await requireSession();
  const userId = (session.user as any).id as string;

  const { searchParams } = new URL(req.url);
  const salonId = searchParams.get("salonId");
  if (!salonId) return NextResponse.json({ error: "salonId is required" }, { status: 400 });

  const customer = await getOrCreateCustomerProfile(userId);
  await prisma.favourite.deleteMany({ where: { customerId: customer.id, salonId } });

  return NextResponse.json({ ok: true });
});
