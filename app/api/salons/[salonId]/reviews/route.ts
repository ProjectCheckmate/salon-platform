import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/lib/permissions";
import { withAuthErrors } from "@/lib/api/withAuthErrors";
import { Prisma } from "@prisma/client";

const bodySchema = z.object({
  appointmentId: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

// GET /api/salons/[salonId]/reviews -> public list + average rating
export async function GET(req: NextRequest, { params }: { params: { salonId: string } }) {
  const reviews = await prisma.review.findMany({
    where: { salonId: params.salonId },
    include: { customer: { include: { user: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const avg =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;

  return NextResponse.json({
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      customerName: r.customer.user.name ?? "Customer",
    })),
    averageRating: avg,
    reviewCount: reviews.length,
  });
}

export const POST = withAuthErrors(async function POST(
  req: NextRequest,
  { params }: { params: { salonId: string } }
) {
  const session = await requireSession();
  const userId = (session.user as any).id as string;

  const json = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: parsed.data.appointmentId },
    include: { customer: true },
  });

  // Reviews are only allowed from a customer's own genuinely COMPLETED
  // appointment at THIS salon — this is the entire anti-fake-review
  // mechanism (spec section 38), enforced server-side, not just in the UI.
  if (
    !appointment ||
    appointment.customer.userId !== userId ||
    appointment.salonId !== params.salonId ||
    appointment.status !== "COMPLETED"
  ) {
    return NextResponse.json(
      { error: "You can only review a salon after a completed appointment there." },
      { status: 403 }
    );
  }

  try {
    const review = await prisma.review.create({
      data: {
        salonId: params.salonId,
        customerId: appointment.customerId,
        appointmentId: appointment.id,
        rating: parsed.data.rating,
        comment: parsed.data.comment,
      },
    });
    return NextResponse.json({ review }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "You've already reviewed this appointment." }, { status: 409 });
    }
    throw err;
  }
});
