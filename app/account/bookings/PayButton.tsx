"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    Razorpay: any;
  }
}

// Razorpay's checkout.js is loaded on demand (not in every page's <head>)
// since only this component ever needs it. It's Razorpay's own hosted
// script, not bundled — this project's network sandbox couldn't verify
// this actually loads and opens correctly (no network access here), but
// this is the standard, documented integration pattern.
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function PayButton({
  appointmentId,
  dueCents,
  razorpayKeyId,
}: {
  appointmentId: string;
  dueCents: number;
  razorpayKeyId: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setLoading(true);
    setError(null);

    if (!razorpayKeyId) {
      setError("Online payment isn't set up for this salon yet — pay by cash/UPI at the salon.");
      setLoading(false);
      return;
    }

    const res = await fetch(`/api/bookings/${appointmentId}/pay`, { method: "POST" });
    if (!res.ok) {
      setError((await res.json()).error ?? "Could not start payment.");
      setLoading(false);
      return;
    }
    const { order } = await res.json();

    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      setError("Could not load the payment widget. Check your connection and try again.");
      setLoading(false);
      return;
    }

    const razorpay = new window.Razorpay({
      key: razorpayKeyId,
      amount: order.providerPayload.amount,
      currency: order.providerPayload.currency,
      order_id: order.orderId,
      name: "Book a Salon Appointment",
      // NOTE: we deliberately do NOT set a handler that marks the booking
      // paid on success here — that would be exactly the frontend-trusted
      // confirmation spec section 24 forbids. The UI just shows Razorpay's
      // own success screen, then refreshes; the actual paymentStatus only
      // ever changes once the webhook (POST /api/payments/webhook) confirms
      // it server-side, which may take a few seconds after this callback fires.
      handler: () => {
        router.refresh();
      },
      modal: {
        ondismiss: () => setLoading(false),
      },
    });

    razorpay.open();
    setLoading(false);
  }

  return (
    <div>
      <button
        onClick={pay}
        disabled={loading}
        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Opening…" : `Pay ₹${(dueCents / 100).toFixed(0)} online`}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
