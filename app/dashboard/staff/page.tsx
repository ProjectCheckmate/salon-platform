"use client";

import { useEffect, useState } from "react";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface StaffMember {
  id: string;
  user: { name: string | null; email: string };
}

export default function StaffDashboardPage({ searchParams }: { searchParams: { salonId?: string } }) {
  const salonId = searchParams.salonId;
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", email: "" });
  const [editingHoursFor, setEditingHoursFor] = useState<string | null>(null);

  async function load() {
    if (!salonId) return;
    setLoading(true);
    const res = await fetch(`/api/owner/salons/${salonId}/staff`);
    const data = await res.json();
    setStaff(data.staff ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salonId]);

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!salonId) return;
    const res = await fetch(`/api/owner/salons/${salonId}/staff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ name: "", email: "" });
      load();
    } else {
      alert((await res.json()).error ?? "Could not add staff");
    }
  }

  if (!salonId) {
    return <main className="mx-auto max-w-2xl px-6 py-8">Missing ?salonId= in URL.</main>;
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Staff</h1>

      <form onSubmit={addStaff} className="mb-8 flex gap-2 rounded-xl border border-neutral-200 p-4">
        <input
          required
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2"
        />
        <input
          required
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2"
        />
        <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white">Add</button>
      </form>

      {loading && <p className="text-neutral-500">Loading…</p>}
      <ul className="space-y-2">
        {staff.map((s) => (
          <li key={s.id} className="rounded-lg border border-neutral-200 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{s.user.name}</p>
                <p className="text-sm text-neutral-500">{s.user.email}</p>
              </div>
              <button
                onClick={() => setEditingHoursFor(editingHoursFor === s.id ? null : s.id)}
                className="text-sm text-blue-600"
              >
                {editingHoursFor === s.id ? "Close" : "Set hours"}
              </button>
            </div>
            {editingHoursFor === s.id && <StaffHoursEditor staffId={s.id} />}
          </li>
        ))}
      </ul>
    </main>
  );
}

function StaffHoursEditor({ staffId }: { staffId: string }) {
  const [days, setDays] = useState(
    WEEKDAYS.map((_, weekday) => ({
      weekday,
      isWorking: weekday !== 0,
      startTime: "10:00",
      endTime: "18:00",
    }))
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/owner/staff/${staffId}/hours`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days, breaks: [] }),
    });
    if (!res.ok) alert((await res.json()).error ?? "Could not save hours");
    setSaving(false);
  }

  return (
    <div className="mt-3 space-y-1 border-t border-neutral-100 pt-3">
      {days.map((d, i) => (
        <div key={d.weekday} className="flex items-center gap-2 text-sm">
          <label className="flex w-20 items-center gap-1.5">
            <input
              type="checkbox"
              checked={d.isWorking}
              onChange={(e) => {
                const copy = [...days];
                copy[i] = { ...copy[i], isWorking: e.target.checked };
                setDays(copy);
              }}
            />
            {WEEKDAYS[d.weekday]}
          </label>
          {d.isWorking && (
            <>
              <input
                type="time"
                value={d.startTime}
                onChange={(e) => {
                  const copy = [...days];
                  copy[i] = { ...copy[i], startTime: e.target.value };
                  setDays(copy);
                }}
                className="rounded border border-neutral-300 px-1.5 py-0.5"
              />
              <input
                type="time"
                value={d.endTime}
                onChange={(e) => {
                  const copy = [...days];
                  copy[i] = { ...copy[i], endTime: e.target.value };
                  setDays(copy);
                }}
                className="rounded border border-neutral-300 px-1.5 py-0.5"
              />
            </>
          )}
        </div>
      ))}
      <button
        onClick={save}
        disabled={saving}
        className="mt-2 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
