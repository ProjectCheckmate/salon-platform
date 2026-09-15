"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import FavouriteButton from "@/app/components/FavouriteButton";

interface Salon {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  distanceKm: number | null;
  services: { priceCents: number }[];
}

export default function SearchPage() {
  const [salons, setSalons] = useState<Salon[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationDenied, setLocationDenied] = useState(false);
  const [query, setQuery] = useState("");

  async function fetchSalons(lat?: number, lng?: number, q?: string) {
    setLoading(true);
    const params = new URLSearchParams();
    if (lat != null && lng != null) {
      params.set("lat", String(lat));
      params.set("lng", String(lng));
    }
    if (q) params.set("q", q);
    const res = await fetch(`/api/salons?${params.toString()}`);
    const data = await res.json();
    setSalons(data.salons ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationDenied(true);
      fetchSalons();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchSalons(pos.coords.latitude, pos.coords.longitude),
      () => {
        setLocationDenied(true);
        fetchSalons(); // fallback: show without distance sort
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced text search fallback
  useEffect(() => {
    const t = setTimeout(() => {
      if (query) fetchSalons(undefined, undefined, query);
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-8 pb-20">
      <input
        placeholder="Search salons or services…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-4 w-full rounded-lg border border-neutral-300 px-4 py-2.5"
      />
      {locationDenied && (
        <p className="mb-4 text-sm text-neutral-500">
          Location access wasn't available — showing salons without distance. Use search instead.
        </p>
      )}

      {loading && <p className="text-neutral-500">Finding salons…</p>}

      <ul className="space-y-3">
        {salons.map((s) => (
          <li key={s.id}>
            <Link
              href={`/salon/${s.slug}`}
              className="block rounded-xl border border-neutral-200 p-4 hover:border-neutral-400"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{s.name}</h3>
                <div className="flex items-center gap-2">
                  {s.distanceKm != null && (
                    <span className="text-sm text-neutral-500">{s.distanceKm.toFixed(1)} km</span>
                  )}
                  <FavouriteButton salonId={s.id} />
                </div>
              </div>
              <p className="text-sm text-neutral-500">{s.address}</p>
              {s.services[0] && (
                <p className="mt-1 text-sm text-neutral-700">
                  From ₹{(s.services[0].priceCents / 100).toFixed(0)}
                </p>
              )}
            </Link>
          </li>
        ))}
        {!loading && salons.length === 0 && (
          <p className="text-neutral-500">No approved salons found yet.</p>
        )}
      </ul>
    </main>
  );
}
