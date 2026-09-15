import { verifyRazorpaySignature } from "./verifyRazorpaySignature";

/**
 * Payment status is NEVER set from a frontend callback. Real providers
 * (e.g. Razorpay) confirm payment only via a signature-verified webhook.
 * See app/api/payments/webhook/route.ts for that flow.
 */
export interface PaymentProvider {
  createOrder(params: { amountCents: number; currency: string; receiptId: string }): Promise<{
    orderId: string;
    providerPayload: unknown;
  }>;
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
  /**
   * Issues a refund against an already-captured payment. `razorpayPaymentId`
   * is the provider's OWN payment id (stored on our Payment row when the
   * webhook confirmed it) — never our internal appointment/payment id,
   * since the provider only knows its own ids.
   */
  refund(params: { razorpayPaymentId: string; amountCents: number }): Promise<{ refundId: string }>;
}

export class MockPaymentProvider implements PaymentProvider {
  async createOrder(params: { amountCents: number; currency: string; receiptId: string }) {
    console.warn("[MockPaymentProvider] Using mock provider — not for production.");
    return {
      orderId: `mock_order_${Date.now()}`,
      providerPayload: { ...params, mock: true },
    };
  }
  verifyWebhookSignature(): boolean {
    // Mock provider treats all incoming events as unverifiable — reject by default.
    return false;
  }
  async refund(params: { razorpayPaymentId: string; amountCents: number }) {
    console.warn(`[MockPaymentProvider] Would refund ${params.amountCents} for ${params.razorpayPaymentId}`);
    return { refundId: `mock_refund_${Date.now()}` };
  }
}

/**
 * Real Razorpay integration, following their documented Orders API
 * (https://razorpay.com/docs/api/orders/) and webhook signature scheme.
 * NEVER TESTED AGAINST RAZORPAY'S ACTUAL SERVERS in this project — this
 * sandbox has no network access to api.razorpay.com, so I've implemented
 * this strictly to the documented request/response shape from training
 * knowledge, not verified live. Before trusting this with real money,
 * test it against Razorpay's test-mode keys first.
 */
export class RazorpayProvider implements PaymentProvider {
  constructor(
    private keyId = process.env.RAZORPAY_KEY_ID,
    private keySecret = process.env.RAZORPAY_KEY_SECRET,
    private webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
  ) {
    if (!keyId || !keySecret) {
      throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set to use RazorpayProvider.");
    }
  }

  async createOrder(params: { amountCents: number; currency: string; receiptId: string }) {
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        // Razorpay's amount is in the smallest currency unit — same as our
        // internal "cents" convention, so no conversion needed for INR (paise).
        amount: params.amountCents,
        currency: params.currency,
        receipt: params.receiptId,
        // notes.appointmentId is the reliable field the webhook reads —
        // receipt is also set to the same value as a fallback, since
        // Razorpay's exact propagation of receipt vs notes onto the
        // payment.captured event isn't something I could verify live here.
        notes: { appointmentId: params.receiptId },
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Razorpay order creation failed: ${res.status} ${errorBody}`);
    }

    const order = await res.json();
    return { orderId: order.id, providerPayload: order };
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!this.webhookSecret) {
      console.error("RAZORPAY_WEBHOOK_SECRET is not set — rejecting all webhooks until it is.");
      return false;
    }
    return verifyRazorpaySignature(rawBody, signature, this.webhookSecret);
  }

  async refund(params: { razorpayPaymentId: string; amountCents: number }) {
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");

    const res = await fetch(`https://api.razorpay.com/v1/payments/${params.razorpayPaymentId}/refund`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({ amount: params.amountCents }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Razorpay refund failed: ${res.status} ${errorBody}`);
    }

    const refund = await res.json();
    return { refundId: refund.id };
  }
}

export function getPaymentProvider(): PaymentProvider {
  const provider = process.env.PAYMENT_PROVIDER || "mock";
  if (provider === "mock") return new MockPaymentProvider();
  if (provider === "razorpay") return new RazorpayProvider();
  throw new Error(`Payment provider "${provider}" not recognized. Use "mock" or "razorpay".`);
}
