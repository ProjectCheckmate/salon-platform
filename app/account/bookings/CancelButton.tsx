"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CancelButton({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);

  async function handleCancel() {
    if (!confirm("Cancel this appointment?")) return;
    setCancelling(true);
    const res = await fetch(`/api/bookings/${appointmentId}/cancel`, { method: "POST" });
    const data = await res.json();

    if (res.ok) {
      const messages: string[] = ["Booking cancelled."];
      if (data.cancellationFeeCents > 0) {
        messages.push(`A ₹${(data.cancellationFeeCents / 100).toFixed(0)} late-cancellation fee applies.`);
      }
      if (data.refundCents > 0) {
        messages.push(`₹${(data.refundCents / 100).toFixed(0)} has been refunded to your original payment method.`);
      }
      alert(messages.join(" "));
      router.refresh();
    } else {
      alert(data.error ?? "Could not cancel this booking.");
    }
    setCancelling(false);
  }

  return (
    <button
      onClick={handleCancel}
      disabled={cancelling}
      className="shrink-0 rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 disabled:opacity-50"
    >
      {cancelling ? "Cancelling…" : "Cancel"}
    </button>
  );
}
