"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Service {
  id: string;
  name: string;
  priceCents: number;
  durationMinutes: number;
  priorityAllowed: boolean;
}
interface StaffMember {
  id: string;
  name: string;
}
interface Slot {
  start: string;
  end: string;
  isPeak: boolean;
  normalPriceCents: number;
  priorityPriceCents: number | null;
}

export default function BookingWidget({
  salonId,
  services,
  staff,
}: {
  salonId: string;
  services: Service[];
  staff: StaffMember[];
}) {
  const router = useRouter();
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [staffId, setStaffId] = useState(staff[0]?.id ?? "");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState<string | null>(null); // slot start being booked
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!serviceId || !staffId || !date) return;
    setLoadingSlots(true);
    setSlots([]);
    const params = new URLSearchParams({ serviceId, staffId, date });
    fetch(`/api/salons/${salonId}/availability?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setSlots(data.slots ?? []))
      .finally(() => setLoadingSlots(false));
  }, [serviceId, staffId, date, salonId]);

  async function book(slot: Slot, bookingType: "NORMAL" | "PRIORITY") {
    setBooking(slot.start);
    setError(null);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        salonId,
        staffId,
        serviceIds: [serviceId],
        startTime: slot.start,
        bookingType,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setConfirmedId(data.appointment.id);
    } else if (res.status === 401) {
      router.push(`/login?next=/salon`);
    } else if (res.status === 409) {
      setError("That slot was just taken — please pick another.");
      // refresh slots since one just got claimed
      const params = new URLSearchParams({ serviceId, staffId, date });
      const r = await fetch(`/api/salons/${salonId}/availability?${params.toString()}`);
      setSlots((await r.json()).slots ?? []);
    } else {
      const data = await res.json();
      setError(typeof data.error === "string" ? data.error : "Could not book that slot.");
    }
    setBooking(null);
  }

  if (confirmedId) {
    return (
      <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-6">
        <h2 className="font-medium text-green-800">Appointment confirmed</h2>
        <p className="mt-1 text-sm text-green-700">Booking ID: {confirmedId}</p>
      </div>
    );
  }

  const selectedService = services.find((s) => s.id === serviceId);

  return (
    <div className="mt-8 space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Service</label>
        <select
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2"
        >
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — ₹{(s.priceCents / 100).toFixed(0)} ({s.durationMinutes} min)
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Staff</label>
        <select
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2"
        >
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Date</label>
        <input
          type="date"
          value={date}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">Available times</label>
        {loadingSlots && <p className="text-sm text-neutral-500">Loading slots…</p>}
        {!loadingSlots && slots.length === 0 && (
          <p className="text-sm text-neutral-500">No slots available this day — try another date.</p>
        )}
        <div className="grid grid-cols-3 gap-2">
          {slots.map((slot) => {
            const label = new Date(slot.start).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            const isBookingThis = booking === slot.start;
            return (
              <div key={slot.start} className="flex flex-col gap-1">
                <button
                  disabled={!!booking}
                  onClick={() => book(slot, "NORMAL")}
                  className="rounded-lg border border-neutral-300 py-2 text-sm hover:border-neutral-900 disabled:opacity-50"
                >
                  {isBookingThis ? (
                    "Booking…"
                  ) : (
                    <>
                      {label}
                      <span className="ml-1 text-xs text-neutral-500">
                        ₹{(slot.normalPriceCents / 100).toFixed(0)}
                        {slot.isPeak && " ⚡"}
                      </span>
                    </>
                  )}
                </button>
                {selectedService?.priorityAllowed && slot.priorityPriceCents != null && (
                  <button
                    disabled={!!booking}
                    onClick={() => book(slot, "PRIORITY")}
                    className="rounded-lg border border-amber-400 bg-amber-50 py-1 text-xs text-amber-800 hover:border-amber-600 disabled:opacity-50"
                  >
                    Priority ₹{(slot.priorityPriceCents / 100).toFixed(0)}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
