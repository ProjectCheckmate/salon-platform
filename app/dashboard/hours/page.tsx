"use client";

import { useEffect, useState } from "react";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface DayHours {
  weekday: number;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
}

function defaultWeek(): DayHours[] {
  return WEEKDAYS.map((_, weekday) => ({
    weekday,
    isOpen: weekday !== 0, // closed Sundays by default, editable
    openTime: "10:00",
    closeTime: "20:00",
  }));
}

export default function HoursDashboardPage({ searchParams }: { searchParams: { salonId?: string } }) {
  const salonId = searchParams.salonId;
  const [days, setDays] = useState<DayHours[]>(defaultWeek());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!salonId) return;
    fetch(`/api/owner/salons/${salonId}/hours`)
      .then((r) => r.json())
      .then((data) => {
        if (data.hours?.length === 7) {
          setDays(
            data.hours
              .sort((a: DayHours, b: DayHours) => a.weekday - b.weekday)
              .map((h: any) => ({
                weekday: h.weekday,
                isOpen: h.isOpen,
                openTime: h.openTime,
                closeTime: h.closeTime,
              }))
          );
        }
      })
      .finally(() => setLoading(false));
  }, [salonId]);

  function updateDay(weekday: number, patch: Partial<DayHours>) {
    setDays((prev) => prev.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));
  }

  async function save() {
    if (!salonId) return;
    setSaving(true);
    const res = await fetch(`/api/owner/salons/${salonId}/hours`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(JSON.stringify(data.error));
    }
    setSaving(false);
  }

  if (!salonId) {
    return <main className="mx-auto max-w-2xl px-6 py-8">Missing ?salonId= in URL.</main>;
  }
  if (loading) {
    return <main className="mx-auto max-w-2xl px-6 py-8 text-neutral-500">Loading…</main>;
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Working Hours</h1>

      <div className="space-y-2">
        {days.map((d) => (
          <div key={d.weekday} className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3">
            <label className="flex w-32 items-center gap-2">
              <input
                type="checkbox"
                checked={d.isOpen}
                onChange={(e) => updateDay(d.weekday, { isOpen: e.target.checked })}
              />
              {WEEKDAYS[d.weekday]}
            </label>
            {d.isOpen ? (
              <>
                <input
                  type="time"
                  value={d.openTime ?? "10:00"}
                  onChange={(e) => updateDay(d.weekday, { openTime: e.target.value })}
                  className="rounded-lg border border-neutral-300 px-2 py-1"
                />
                <span className="text-neutral-400">to</span>
                <input
                  type="time"
                  value={d.closeTime ?? "20:00"}
                  onChange={(e) => updateDay(d.weekday, { closeTime: e.target.value })}
                  className="rounded-lg border border-neutral-300 px-2 py-1"
                />
              </>
            ) : (
              <span className="text-sm text-neutral-400">Closed</span>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="mt-6 rounded-lg bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save hours"}
      </button>
    </main>
  );
}
