import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireSession } from "@/lib/permissions";
import { withAuthErrors } from "@/lib/api/withAuthErrors";
import { getPaymentProvider } from "@/lib/payments/paymentProvider";

/**
 * Returns a Razorpay order for the frontend to open Razorpay Checkout
 * with. This endpoint does NOT mark anything as paid — it only creates
 * the order. Payment is only ever confirmed by the webhook after Razorpay
 * itself verifies the transaction (spec section 24).
 */
export const POST = withAuthErrors(async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireSession();
  const userId = (session.user as any).id as string;

  const appointment = await prisma.appointment.findUnique({
    where: { id: params.id },
    include: { customer: true },
  });
  if (!appointment) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (appointment.customer.userId !== userId) {
    return NextResponse.json({ error: "You can't pay for this booking" }, { status: 403 });
  }

  const dueCents = appointment.totalAmountCents - appointment.paidAmountCents;
  if (dueCents <= 0) {
    return NextResponse.json({ error: "This booking is already fully paid" }, { status: 400 });
  }

  try {
    const provider = getPaymentProvider();
    const order = await provider.createOrder({
      amountCents: dueCents,
      currency: "INR",
      receiptId: appointment.id,
    });
    return NextResponse.json({ order });
  } catch (err) {
    console.error("Razorpay order creation failed:", err);
    return NextResponse.json(
      { error: "Could not start online payment right now. Please try cash/UPI at the salon instead." },
      { status: 503 }
    );
  }
});
