"use client";

import { useEffect, useState } from "react";

interface Transaction {
  id: string;
  type: "CREDIT" | "DEBIT";
  amountCents: number;
  reason: string;
  createdAt: string;
}

export default function WalletPage() {
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    fetch("/api/wallet")
      .then((r) => r.json())
      .then((data) => {
        setBalanceCents(data.balanceCents);
        setTransactions(data.transactions ?? []);
      });
  }, []);

  return (
    <main className="mx-auto max-w-2xl px-6 py-8 pb-20">
      <h1 className="mb-2 text-2xl font-semibold">Wallet</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Credit from referral rewards — spendable at any salon on the platform.
      </p>

      <div className="mb-8 rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
        <p className="text-sm text-neutral-500">Available balance</p>
        <p className="text-3xl font-semibold">
          {balanceCents == null ? "…" : `₹${(balanceCents / 100).toFixed(0)}`}
        </p>
      </div>

      <h2 className="mb-3 text-lg font-medium">History</h2>
      {transactions.length === 0 && <p className="text-sm text-neutral-500">No transactions yet.</p>}
      <ul className="space-y-2">
        {transactions.map((t) => (
          <li key={t.id} className="flex items-center justify-between rounded-lg border border-neutral-200 p-3">
            <div>
              <p className="text-sm">{t.reason}</p>
              <p className="text-xs text-neutral-400">{new Date(t.createdAt).toLocaleDateString()}</p>
            </div>
            <span className={`text-sm font-medium ${t.type === "CREDIT" ? "text-green-700" : "text-red-600"}`}>
              {t.type === "CREDIT" ? "+" : "-"}₹{(t.amountCents / 100).toFixed(0)}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
