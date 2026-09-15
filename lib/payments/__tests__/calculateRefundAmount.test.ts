import { describe, it, expect } from "vitest";
import { calculateRefundAmount } from "../calculateRefundAmount";

describe("calculateRefundAmount", () => {
  it("refunds the full paid amount when there's no cancellation fee", () => {
    expect(calculateRefundAmount(30000, 0)).toBe(30000);
  });

  it("subtracts the cancellation fee from the refund", () => {
    expect(calculateRefundAmount(30000, 10000)).toBe(20000);
  });

  it("never refunds a negative amount when the fee exceeds what was paid", () => {
    expect(calculateRefundAmount(5000, 10000)).toBe(0);
  });

  it("refunds nothing if nothing was paid", () => {
    expect(calculateRefundAmount(0, 0)).toBe(0);
  });
});
