import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/permissions";
import { withAuthErrors } from "@/lib/api/withAuthErrors";

// GET /api/admin/salon-applications?status=PENDING
export const GET = withAuthErrors(async function GET(req: NextRequest) {
  await requireRole("ADMIN");
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "PENDING";

  const applications = await prisma.salonApplication.findMany({
    where: { status: status as any },
    include: { salon: true },
    orderBy: { submittedAt: "asc" },
  });

  return NextResponse.json({ applications });
});
