import { describe, it, expect } from "vitest";
import { calculateTax } from "../calculateTax";

describe("calculateTax", () => {
  it("calculates GST-style tax correctly (18% example)", () => {
    expect(calculateTax(30000, 18)).toBe(5400);
  });

  it("returns 0 when the salon has no tax configured", () => {
    expect(calculateTax(30000, 0)).toBe(0);
  });

  it("returns 0 on a zero or negative subtotal, never a negative tax", () => {
    expect(calculateTax(0, 18)).toBe(0);
    expect(calculateTax(-500, 18)).toBe(0);
  });

  it("rounds to the nearest whole cent/paisa", () => {
    expect(calculateTax(333, 18)).toBe(60); // 333 * 0.18 = 59.94 -> 60
  });
});
