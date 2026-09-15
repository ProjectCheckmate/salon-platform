"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReviewPrompt({ appointmentId, salonId }: { appointmentId: string; salonId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    const res = await fetch(`/api/salons/${salonId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId, rating, comment: comment || undefined }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      alert(data.error ?? "Could not submit review");
    }
    setSubmitting(false);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-2 text-sm font-medium text-blue-600">
        Leave a review
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-neutral-200 p-3">
      <div className="mb-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setRating(n)}
            className={`text-xl ${n <= rating ? "text-amber-500" : "text-neutral-300"}`}
            aria-label={`${n} star`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional feedback…"
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        rows={2}
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={submit}
          disabled={submitting}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit review"}
        </button>
        <button onClick={() => setOpen(false)} className="text-sm text-neutral-500">
          Cancel
        </button>
      </div>
    </div>
  );
}
