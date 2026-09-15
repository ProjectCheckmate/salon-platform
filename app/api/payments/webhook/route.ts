import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { getPaymentProvider } from "@/lib/payments/paymentProvider";
import { logAudit } from "@/lib/audit/logAudit";

/**
 * spec section 24: "Never mark an online payment as successful solely
 * based on frontend input." This route is the single place in the entire
 * codebase that ever sets paymentStatus from an ONLINE payment — nothing
 * in the customer-facing booking/payment flow does this directly.
 *
 * CRITICAL: reads the RAW body via req.text(), not req.json(). Signature
 * verification must run against the exact bytes Razorpay signed — if this
 * were parsed to JSON and re-serialized first, whitespace/key-order
 * differences would break every signature check.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  const provider = getPaymentProvider();
  if (!provider.verifyWebhookSignature(rawBody, signature)) {
    console.error("Razorpay webhook: signature verification failed — rejecting.");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only payment.captured is treated as a confirmed successful payment.
  // payment.failed is logged for visibility (so a failed attempt isn't
  // silently invisible to the owner) but deliberately makes no DB change —
  // an appointment that never got paid stays exactly as unpaid as it
  // already was; there's nothing to "undo".
  if (event.event === "payment.failed") {
    const failedPayment = event.payload?.payment?.entity;
    console.error("Razorpay payment failed:", failedPayment?.id, failedPayment?.error_description);
    await logAudit({
      actorId: null,
      action: "ONLINE_PAYMENT_FAILED",
      entity: "Appointment",
      entityId: failedPayment?.notes?.appointmentId ?? failedPayment?.receipt ?? "unknown",
      metadata: { razorpayPaymentId: failedPayment?.id, reason: failedPayment?.error_description },
    });
    return NextResponse.json({ received: true, handled: true });
  }

  if (event.event !== "payment.captured") {
    return NextResponse.json({ received: true, handled: false });
  }

  const payment = event.payload?.payment?.entity;
  // The appointment id is passed as a Razorpay "note" when the order is
  // created (see createOrder's receipt field / notes, whichever the actual
  // checkout integration ends up using) — receipt is used here since
  // createOrder sets receiptId to the appointment id.
  const appointmentId: string | undefined = payment?.notes?.appointmentId ?? payment?.receipt;
  const amountCents: number | undefined = payment?.amount;
  const razorpayPaymentId: string | undefined = payment?.id;

  if (!appointmentId || !amountCents || !razorpayPaymentId) {
    console.error("Razorpay webhook: payment.captured event missing expected fields", event);
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appointment) {
    console.error(`Razorpay webhook: no appointment found for id ${appointmentId}`);
    return NextResponse.json({ error: "Unknown appointment" }, { status: 404 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // razorpayPaymentId is @unique — this is the real idempotency
      // guarantee. If Razorpay retries this exact webhook (which they do,
      // by design, until you return 2xx), the second attempt hits the
      // unique constraint and throws P2002, caught below, instead of
      // double-crediting the payment.
      await tx.payment.create({
        data: {
          appointmentId,
          amountCents,
          method: "ONLINE",
          recordedById: null, // no logged-in user initiated this — it's a webhook
          razorpayPaymentId,
        },
      });

      const agg = await tx.payment.aggregate({
        where: { appointmentId },
        _sum: { amountCents: true },
      });
      const paidAmountCents = agg._sum.amountCents ?? 0;
      const paymentStatus =
        paidAmountCents <= 0 ? "UNPAID" : paidAmountCents >= appointment.totalAmountCents ? "PAID" : "PARTIAL";

      return tx.appointment.update({
        where: { id: appointmentId },
        data: { paidAmountCents, paymentStatus },
      });
    });

    await logAudit({
      actorId: null,
      action: "ONLINE_PAYMENT_CONFIRMED",
      entity: "Appointment",
      entityId: appointmentId,
      metadata: { amountCents, razorpayPaymentId },
    });

    return NextResponse.json({ received: true, appointmentId: result.id });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Duplicate webhook delivery for a payment we already processed —
      // this is expected and normal, not an error. Return 2xx so Razorpay
      // stops retrying.
      return NextResponse.json({ received: true, alreadyProcessed: true });
    }
    console.error("Razorpay webhook processing failed:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
