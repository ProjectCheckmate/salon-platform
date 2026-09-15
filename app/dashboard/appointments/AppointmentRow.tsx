"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AppointmentData {
  id: string;
  customerName: string;
  staffName: string;
  services: string[];
  startTime: string;
  status: string;
  totalAmountCents: number;
  paidAmountCents: number;
  paymentStatus: string;
}

export default function AppointmentRow({ appointment }: { appointment: AppointmentData }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const dueCents = appointment.totalAmountCents - appointment.paidAmountCents;

  async function markComplete() {
    setBusy(true);
    const res = await fetch(`/api/owner/appointments/${appointment.id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome: "COMPLETED" }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.invoiceId) setInvoiceId(data.invoiceId);
      router.refresh();
    } else alert((await res.json()).error ?? "Could not update");
    setBusy(false);
  }

  async function recordPayment(method: "CASH" | "UPI") {
    const input = prompt(`Amount received in ₹ (due: ₹${(dueCents / 100).toFixed(0)})`);
    if (!input) return;
    const amountCents = Math.round(parseFloat(input) * 100);
    if (!amountCents || amountCents <= 0) return;

    setBusy(true);
    const res = await fetch(`/api/owner/appointments/${appointment.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountCents, method }),
    });
    if (res.ok) router.refresh();
    else alert((await res.json()).error ?? "Could not record payment");
    setBusy(false);
  }

  return (
    <li className="rounded-xl border border-neutral-200 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">
            {new Date(appointment.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            {" · "}
            {appointment.customerName}
          </p>
          <p className="text-sm text-neutral-500">
            {appointment.services.join(", ")} with {appointment.staffName}
          </p>
          <p className="mt-1 text-xs uppercase tracking-wide text-neutral-400">
            {appointment.status} · {appointment.paymentStatus} · Due ₹{(dueCents / 100).toFixed(0)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          {appointment.status !== "COMPLETED" && appointment.status !== "CANCELLED" && (
            <button
              disabled={busy}
              onClick={markComplete}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Mark completed
            </button>
          )}
          {invoiceId && (
            <a href={`/account/invoices/${invoiceId}`} className="text-xs text-blue-600">
              View invoice
            </a>
          )}
          {dueCents > 0 && (
            <div className="flex gap-1.5">
              <button
                disabled={busy}
                onClick={() => recordPayment("CASH")}
                className="rounded-lg border border-neutral-300 px-2 py-1 text-xs disabled:opacity-50"
              >
                + Cash
              </button>
              <button
                disabled={busy}
                onClick={() => recordPayment("UPI")}
                className="rounded-lg border border-neutral-300 px-2 py-1 text-xs disabled:opacity-50"
              >
                + UPI
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
