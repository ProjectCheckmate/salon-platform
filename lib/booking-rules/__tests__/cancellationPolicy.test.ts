import { describe, it, expect } from "vitest";
import { calculateCancellationFee, DEFAULT_CANCELLATION_POLICY } from "../cancellationPolicy";

describe("cancellation policy", () => {
  const now = new Date("2026-09-05T10:00:00Z");

  it("no fee when cancelling more than the free window before start", () => {
    const start = new Date("2026-09-05T15:00:00Z"); // 5 hours away
    expect(calculateCancellationFee(start, now)).toBe(0);
  });

  it("fee applies when cancelling inside the free window", () => {
    const start = new Date("2026-09-05T12:00:00Z"); // 2 hours away
    expect(calculateCancellationFee(start, now)).toBe(DEFAULT_CANCELLATION_POLICY.lateFeeCents);
  });

  it("exactly at the boundary counts as free (>=)", () => {
    const start = new Date("2026-09-05T14:00:00Z"); // exactly 4 hours away
    expect(calculateCancellationFee(start, now)).toBe(0);
  });

  it("respects a custom policy", () => {
    const start = new Date("2026-09-05T11:00:00Z"); // 1 hour away
    const fee = calculateCancellationFee(start, now, { freeWindowHours: 2, lateFeeCents: 20000 });
    expect(fee).toBe(20000);
  });
});
