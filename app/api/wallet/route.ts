import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/lib/permissions";
import { withAuthErrors } from "@/lib/api/withAuthErrors";

export const GET = withAuthErrors(async function GET() {
  const session = await requireSession();
  const userId = (session.user as any).id as string;

  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    include: { transactions: { orderBy: { createdAt: "desc" }, take: 20 } },
  });

  return NextResponse.json({
    balanceCents: wallet?.balanceCents ?? 0,
    transactions: wallet?.transactions ?? [],
  });
});
