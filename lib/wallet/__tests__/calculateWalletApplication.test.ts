import { describe, it, expect } from "vitest";
import { calculateWalletApplication } from "../calculateWalletApplication";

describe("calculateWalletApplication", () => {
  it("applies the full requested amount when balance and bill both cover it", () => {
    expect(calculateWalletApplication(10000, 5000, 30000)).toBe(5000);
  });

  it("caps at the wallet balance when requesting more than available", () => {
    expect(calculateWalletApplication(3000, 5000, 30000)).toBe(3000);
  });

  it("caps at the bill amount so the bill never goes negative", () => {
    expect(calculateWalletApplication(50000, 40000, 10000)).toBe(10000);
  });

  it("returns 0 for a zero or negative balance, request, or bill", () => {
    expect(calculateWalletApplication(0, 5000, 30000)).toBe(0);
    expect(calculateWalletApplication(10000, 0, 30000)).toBe(0);
    expect(calculateWalletApplication(10000, 5000, 0)).toBe(0);
    expect(calculateWalletApplication(-100, 5000, 30000)).toBe(0);
  });
});
