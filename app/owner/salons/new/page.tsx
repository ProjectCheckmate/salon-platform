"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewSalonPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", address: "", phone: "", latitude: "", longitude: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setForm((f) => ({
        ...f,
        latitude: String(pos.coords.latitude),
        longitude: String(pos.coords.longitude),
      }));
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/salons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        address: form.address,
        phone: form.phone,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
      }),
    });

    if (res.ok) {
      router.push("/dashboard?submitted=1");
    } else {
      const data = await res.json();
      setError(typeof data.error === "string" ? data.error : "Please check the form and try again.");
    }
    setSubmitting(false);
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-10">
      <h1 className="mb-2 text-2xl font-semibold">Submit your salon</h1>
      <p className="mb-6 text-sm text-neutral-500">
        An admin will review your submission before it goes live publicly.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Salon name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Address</label>
          <input
            required
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Phone</label>
          <input
            required
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-medium">Location</label>
            <button type="button" onClick={useMyLocation} className="text-sm text-blue-600">
              Use my current location
            </button>
          </div>
          <div className="flex gap-2">
            <input
              required
              placeholder="Latitude"
              value={form.latitude}
              onChange={(e) => setForm({ ...form, latitude: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            />
            <input
              required
              placeholder="Longitude"
              value={form.longitude}
              onChange={(e) => setForm({ ...form, longitude: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-neutral-900 py-2.5 font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit for approval"}
        </button>
      </form>
    </main>
  );
}
