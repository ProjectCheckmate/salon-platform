"use client";

import { useEffect, useState } from "react";

interface ReferralInfo {
  code: string;
  referrals: { id: string; referredName: string; status: string; rewardCents: number }[];
}

export default function ReferralsPage() {
  const [data, setData] = useState<ReferralInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/referrals")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return <main className="mx-auto max-w-2xl px-6 py-8 text-neutral-500">Loading…</main>;

  const link = typeof window !== "undefined" ? `${window.location.origin}/signup?ref=${data.code}` : "";

  return (
    <main className="mx-auto max-w-2xl px-6 py-8 pb-20">
      <h1 className="mb-2 text-2xl font-semibold">Refer a friend</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Share your link — when a friend signs up and completes their first paid visit, you both get ₹100.
      </p>

      <div className="mb-8 flex items-center gap-2 rounded-xl border border-neutral-200 p-4">
        <code className="flex-1 truncate text-sm">{link}</code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      <h2 className="mb-3 text-lg font-medium">Your referrals</h2>
      {data.referrals.length === 0 && <p className="text-sm text-neutral-500">No referrals yet.</p>}
      <ul className="space-y-2">
        {data.referrals.map((r) => (
          <li key={r.id} className="flex items-center justify-between rounded-lg border border-neutral-200 p-3">
            <span className="text-sm">{r.referredName}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                r.status === "REWARDED" ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
              }`}
            >
              {r.status === "REWARDED" ? `₹${r.rewardCents / 100} earned` : "Pending first visit"}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
