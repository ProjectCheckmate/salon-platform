"use client";

import { useState } from "react";

interface Message {
  role: "user" | "assistant";
  text: string;
}

const SUGGESTIONS = [
  "Aaj kitni appointments hain?",
  "Meri sales kyun kam hui?",
  "Kaunse customers ko contact karna chahiye?",
  "Is month revenue badhane ke 3 tareeke batao.",
];

export default function AIAssistantPage({ searchParams }: { searchParams: { salonId?: string } }) {
  const salonId = searchParams.salonId;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(question: string) {
    if (!salonId || !question.trim()) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setLoading(true);

    const res = await fetch(`/api/owner/salons/${salonId}/ai-assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    if (res.ok) {
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", text: data.answer }]);
    } else {
      const data = await res.json();
      setMessages((m) => [
        ...m,
        { role: "assistant", text: data.error ?? "Something went wrong reaching the assistant." },
      ]);
    }
    setLoading(false);
  }

  if (!salonId) {
    return <main className="mx-auto max-w-2xl px-6 py-8">Missing ?salonId= in URL.</main>;
  }

  return (
    <main className="mx-auto flex h-[calc(100vh-2rem)] max-w-2xl flex-col px-6 py-8">
      <h1 className="mb-1 text-2xl font-semibold">AI Business Assistant</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Answers are grounded in your real appointment and revenue data — nothing is invented.
      </p>

      {messages.length === 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:border-neutral-900"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-neutral-900 px-4 py-2 text-sm text-white"
                : "mr-auto max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-neutral-100 px-4 py-2 text-sm"
            }
          >
            {m.text}
          </div>
        ))}
        {loading && <p className="text-sm text-neutral-400">Thinking…</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="mt-4 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Apna business ke baare mein poochho…"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2"
        />
        <button
          disabled={loading || !input.trim()}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </main>
  );
}
