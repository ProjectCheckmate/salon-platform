import { describe, it, expect } from "vitest";
import { applyCoupon, type CouponData } from "../applyCoupon";

const now = new Date("2026-09-05T00:00:00Z");

function baseCoupon(overrides: Partial<CouponData> = {}): CouponData {
  return {
    type: "PERCENTAGE",
    value: 10,
    maxUsesTotal: null,
    currentUsesTotal: 0,
    maxUsesPerCustomer: 1,
    currentUsesByThisCustomer: 0,
    minSpendCents: 0,
    validFrom: new Date("2026-01-01T00:00:00Z"),
    validUntil: null,
    active: true,
    ...overrides,
  };
}

describe("applyCoupon", () => {
  it("applies a percentage discount correctly", () => {
    const result = applyCoupon(baseCoupon({ type: "PERCENTAGE", value: 20 }), 30000, now);
    expect(result).toEqual({ valid: true, discountCents: 6000 });
  });

  it("applies a fixed discount, capped at the subtotal", () => {
    const small = applyCoupon(baseCoupon({ type: "FIXED", value: 5000 }), 3000, now);
    expect(small).toEqual({ valid: true, discountCents: 3000 }); // capped, not negative total
    const normal = applyCoupon(baseCoupon({ type: "FIXED", value: 5000 }), 30000, now);
    expect(normal).toEqual({ valid: true, discountCents: 5000 });
  });

  it("rejects an inactive coupon", () => {
    const result = applyCoupon(baseCoupon({ active: false }), 30000, now);
    expect(result.valid).toBe(false);
  });

  it("rejects before validFrom and after validUntil", () => {
    const notYet = applyCoupon(baseCoupon({ validFrom: new Date("2027-01-01T00:00:00Z") }), 30000, now);
    expect(notYet.valid).toBe(false);

    const expired = applyCoupon(baseCoupon({ validUntil: new Date("2026-01-01T00:00:00Z") }), 30000, now);
    expect(expired.valid).toBe(false);
  });

  it("rejects once total usage limit is hit", () => {
    const result = applyCoupon(baseCoupon({ maxUsesTotal: 5, currentUsesTotal: 5 }), 30000, now);
    expect(result.valid).toBe(false);
  });

  it("rejects once this specific customer has used it up", () => {
    const result = applyCoupon(
      baseCoupon({ maxUsesPerCustomer: 1, currentUsesByThisCustomer: 1 }),
      30000,
      now
    );
    expect(result.valid).toBe(false);
  });

  it("rejects when the subtotal is below the minimum spend", () => {
    const result = applyCoupon(baseCoupon({ minSpendCents: 50000 }), 30000, now);
    expect(result.valid).toBe(false);
  });

  it("allows exactly at the minimum spend boundary", () => {
    const result = applyCoupon(baseCoupon({ minSpendCents: 30000 }), 30000, now);
    expect(result.valid).toBe(true);
  });
});
