"use client";

import { useEffect, useState } from "react";

interface Application {
  id: string;
  status: string;
  submittedAt: string;
  salon: { id: string; name: string; address: string | null; phone: string | null };
}

export default function SalonApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/salon-applications?status=PENDING");
    const data = await res.json();
    setApplications(data.applications ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(id: string, decision: "APPROVE" | "REJECT") {
    setActingOn(id);
    const res = await fetch(`/api/admin/salon-applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    if (res.ok) {
      setApplications((prev) => prev.filter((a) => a.id !== id));
    } else {
      const err = await res.json();
      alert(err.error ?? "Something went wrong");
    }
    setActingOn(null);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Pending Salon Applications</h1>

      {loading && <p className="text-neutral-500">Loading…</p>}
      {!loading && applications.length === 0 && (
        <p className="text-neutral-500">No pending applications right now.</p>
      )}

      <ul className="space-y-4">
        {applications.map((app) => (
          <li key={app.id} className="rounded-xl border border-neutral-200 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-medium">{app.salon.name}</h2>
                <p className="text-sm text-neutral-500">{app.salon.address}</p>
                <p className="text-sm text-neutral-500">{app.salon.phone}</p>
                <p className="mt-1 text-xs text-neutral-400">
                  Submitted {new Date(app.submittedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  disabled={actingOn === app.id}
                  onClick={() => decide(app.id, "APPROVE")}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  disabled={actingOn === app.id}
                  onClick={() => decide(app.id, "REJECT")}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
