"use client";

import { useEffect, useState } from "react";

interface Breakdown {
  inactiveCustomersCents: number;
  cancelledAppointmentsCents: number;
  pendingPaymentsCents: number;
  emptySlotCents: number;
  totalEstimatedCents: number;
}
interface OverdueCustomer {
  customerId: string;
  daysOverdue: number;
  daysSinceLastVisit: number;
  averageIntervalDays: number;
}

function rupees(cents: number) {
  return `₹${(cents / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function RevenueRecoveryPage({ searchParams }: { searchParams: { salonId?: string } }) {
  const salonId = searchParams.salonId;
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [overdue, setOverdue] = useState<OverdueCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  useEffect(() => {
    if (!salonId) return;
    fetch(`/api/owner/salons/${salonId}/revenue-recovery`)
      .then((r) => r.json())
      .then((data) => {
        setBreakdown(data.breakdown);
        setOverdue(data.overdueCustomers ?? []);
      })
      .finally(() => setLoading(false));
  }, [salonId]);

  function toggle(customerId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) next.delete(customerId);
      else next.add(customerId);
      return next;
    });
  }

  async function sendCampaign() {
    if (!salonId || selected.size === 0) return;
    setSending(true);
    setSendResult(null);

    const daysSinceLastVisitByCustomer: Record<string, number> = {};
    for (const c of overdue) {
      if (selected.has(c.customerId)) daysSinceLastVisitByCustomer[c.customerId] = c.daysSinceLastVisit;
    }

    const res = await fetch(`/api/owner/salons/${salonId}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerIds: Array.from(selected), daysSinceLastVisitByCustomer }),
    });

    if (res.ok) {
      const data = await res.json();
      setSendResult(
        `Sent to ${data.sentCount} customer${data.sentCount === 1 ? "" : "s"}${
          data.skippedCount > 0 ? ` (${data.skippedCount} skipped — no contact info or opted out)` : ""
        }.`
      );
      setSelected(new Set());
    } else {
      setSendResult((await res.json()).error ?? "Could not send campaign.");
    }
    setSending(false);
  }

  if (!salonId) return <main className="mx-auto max-w-2xl px-6 py-8">Missing ?salonId= in URL.</main>;
  if (loading) return <main className="mx-auto max-w-2xl px-6 py-8 text-neutral-500">Loading…</main>;
  if (!breakdown) return null;

  const rows = [
    { label: "Inactive customers", cents: breakdown.inactiveCustomersCents },
    { label: "Cancelled appointments", cents: breakdown.cancelledAppointmentsCents },
    { label: "Pending payments", cents: breakdown.pendingPaymentsCents },
    { label: "Empty slot upsell", cents: breakdown.emptySlotCents },
  ];

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Money Opportunities</h1>
      <p className="mt-1 text-sm text-neutral-500">
        These are estimates based on your historical data — not guaranteed income.
      </p>

      <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
        <p className="text-sm text-neutral-500">Potential revenue (estimate)</p>
        <p className="text-3xl font-semibold">{rupees(breakdown.totalEstimatedCents)}</p>
      </div>

      <ul className="mt-4 space-y-2">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between rounded-lg border border-neutral-200 p-3">
            <span className="text-sm">{r.label}</span>
            <span className="font-medium">{rupees(r.cents)}</span>
          </li>
        ))}
      </ul>

      <h2 className="mb-3 mt-8 text-lg font-medium">Customers to contact</h2>
      {overdue.length === 0 && (
        <p className="text-sm text-neutral-500">No overdue customers detected yet.</p>
      )}
      <ul className="space-y-2">
        {overdue.map((c) => (
          <li
            key={c.customerId}
            className="flex items-center justify-between rounded-lg border border-neutral-200 p-3"
          >
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selected.has(c.customerId)}
                onChange={() => toggle(c.customerId)}
              />
              <div>
                <p className="text-sm font-medium">Customer {c.customerId.slice(0, 8)}</p>
                <p className="text-xs text-neutral-500">
                  Usually visits every {c.averageIntervalDays} days — last seen {c.daysSinceLastVisit} days ago
                </p>
              </div>
            </label>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {c.daysOverdue}d overdue
            </span>
          </li>
        ))}
      </ul>

      {overdue.length > 0 && (
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={sendCampaign}
            disabled={selected.size === 0 || sending}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {sending ? "Sending…" : `Send Campaign (${selected.size} selected)`}
          </button>
          {sendResult && <p className="text-sm text-neutral-500">{sendResult}</p>}
        </div>
      )}
    </main>
  );
}
