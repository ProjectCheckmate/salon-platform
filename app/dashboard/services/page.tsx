"use client";

import { useEffect, useState } from "react";

interface Service {
  id: string;
  name: string;
  priceCents: number;
  durationMinutes: number;
  bufferMinutes: number;
  active: boolean;
  priorityAllowed: boolean;
}

// NOTE: salonId would normally come from the owner's session/current-salon
// context (set once they have >1 salon via a picker). For Phase 2 this
// reads it from a query param — replace with real session-derived salonId
// once the multi-salon owner switcher exists.
export default function ServicesDashboardPage({
  searchParams,
}: {
  searchParams: { salonId?: string };
}) {
  const salonId = searchParams.salonId;
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", priceCents: "", durationMinutes: "", bufferMinutes: "0" });
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!salonId) return;
    setLoading(true);
    const res = await fetch(`/api/owner/salons/${salonId}/services`);
    const data = await res.json();
    setServices(data.services ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salonId]);

  async function addService(e: React.FormEvent) {
    e.preventDefault();
    if (!salonId) return;
    setSaving(true);
    const res = await fetch(`/api/owner/salons/${salonId}/services`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        priceCents: Math.round(parseFloat(form.priceCents) * 100),
        durationMinutes: parseInt(form.durationMinutes, 10),
        bufferMinutes: parseInt(form.bufferMinutes || "0", 10),
      }),
    });
    if (res.ok) {
      setForm({ name: "", priceCents: "", durationMinutes: "", bufferMinutes: "0" });
      load();
    } else {
      const data = await res.json();
      alert(JSON.stringify(data.error));
    }
    setSaving(false);
  }

  async function toggleActive(service: Service) {
    if (!salonId) return;
    await fetch(`/api/owner/salons/${salonId}/services/${service.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !service.active }),
    });
    load();
  }

  if (!salonId) {
    return <main className="mx-auto max-w-2xl px-6 py-8">Missing ?salonId= in URL.</main>;
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Services</h1>

      <form onSubmit={addService} className="mb-8 grid grid-cols-2 gap-3 rounded-xl border border-neutral-200 p-4">
        <input
          required
          placeholder="Service name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="col-span-2 rounded-lg border border-neutral-300 px-3 py-2"
        />
        <input
          required
          type="number"
          step="0.01"
          placeholder="Price (₹)"
          value={form.priceCents}
          onChange={(e) => setForm({ ...form, priceCents: e.target.value })}
          className="rounded-lg border border-neutral-300 px-3 py-2"
        />
        <input
          required
          type="number"
          placeholder="Duration (min)"
          value={form.durationMinutes}
          onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
          className="rounded-lg border border-neutral-300 px-3 py-2"
        />
        <input
          type="number"
          placeholder="Buffer (min)"
          value={form.bufferMinutes}
          onChange={(e) => setForm({ ...form, bufferMinutes: e.target.value })}
          className="rounded-lg border border-neutral-300 px-3 py-2"
        />
        <button
          disabled={saving}
          className="col-span-2 rounded-lg bg-neutral-900 py-2 font-medium text-white disabled:opacity-50"
        >
          {saving ? "Adding…" : "Add service"}
        </button>
      </form>

      {loading && <p className="text-neutral-500">Loading…</p>}
      <ul className="space-y-2">
        {services.map((s) => (
          <li key={s.id} className="flex items-center justify-between rounded-lg border border-neutral-200 p-3">
            <div>
              <p className={s.active ? "font-medium" : "font-medium text-neutral-400 line-through"}>{s.name}</p>
              <p className="text-sm text-neutral-500">
                ₹{(s.priceCents / 100).toFixed(0)} · {s.durationMinutes} min
                {s.bufferMinutes > 0 && ` + ${s.bufferMinutes} min buffer`}
              </p>
            </div>
            <button onClick={() => toggleActive(s)} className="text-sm text-blue-600">
              {s.active ? "Deactivate" : "Activate"}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
