import { describe, it, expect } from "vitest";
import { calculatePointsEarned, DEFAULT_LOYALTY_RULE } from "../calculatePointsEarned";

describe("calculatePointsEarned", () => {
  it("matches the spec example: ₹100 spent = 1 point", () => {
    expect(calculatePointsEarned(10000)).toBe(1);
  });

  it("floors partial points rather than rounding", () => {
    expect(calculatePointsEarned(15000)).toBe(1); // ₹150 -> still just 1 point
    expect(calculatePointsEarned(19999)).toBe(1);
    expect(calculatePointsEarned(20000)).toBe(2);
  });

  it("zero or negative spend earns zero points", () => {
    expect(calculatePointsEarned(0)).toBe(0);
    expect(calculatePointsEarned(-500)).toBe(0);
  });

  it("respects a custom owner-configured rate", () => {
    const rule = { centsPerPoint: 5000 }; // ₹50/point
    expect(calculatePointsEarned(10000, rule)).toBe(2);
  });

  it("default rule matches DEFAULT_LOYALTY_RULE export", () => {
    expect(calculatePointsEarned(30000)).toBe(30000 / DEFAULT_LOYALTY_RULE.centsPerPoint);
  });
});
