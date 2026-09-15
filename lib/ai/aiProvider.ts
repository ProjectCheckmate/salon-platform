/**
 * AI provider abstraction. The salon owner's "AI Business Assistant" (Phase 7)
 * will call this with a prompt PLUS a JSON block of real, already-queried
 * data (revenue, appointments, customer lists). The provider must never be
 * asked to invent numbers — the context passed in is the only source of truth.
 */
export interface AIProvider {
  ask(prompt: string, context: Record<string, unknown>): Promise<string>;
}

export class OllamaProvider implements AIProvider {
  constructor(
    private baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    private model = process.env.OLLAMA_MODEL || "llama3.1"
  ) {}

  async ask(prompt: string, context: Record<string, unknown>): Promise<string> {
    const systemPrompt = [
      "You are a salon business assistant.",
      "You may ONLY use numbers present in the JSON context below.",
      "If the context doesn't contain what's needed to answer, say so — never estimate or invent figures.",
      "",
      `CONTEXT: ${JSON.stringify(context)}`,
    ].join("\n");

    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt: `${systemPrompt}\n\nQUESTION: ${prompt}`,
        stream: false,
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama request failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    return data.response as string;
  }
}

export function getAIProvider(): AIProvider {
  return new OllamaProvider();
}
