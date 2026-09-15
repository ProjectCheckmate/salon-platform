import { describe, it, expect } from "vitest";
import { applyMembership } from "../applyMembership";

const now = new Date("2026-09-05T00:00:00Z");
const notExpired = new Date("2027-01-01T00:00:00Z");
const expired = new Date("2026-01-01T00:00:00Z");

describe("applyMembership", () => {
  it("returns NONE when there's no membership", () => {
    const result = applyMembership(null, "haircut", 30000, now);
    expect(result.type).toBe("NONE");
    expect(result.discountCents).toBe(0);
  });

  it("returns NONE for an expired membership, even with remaining benefits", () => {
    const membership = {
      discountPercent: 10,
      expiresAt: expired,
      benefits: [{ serviceId: "haircut", includedCount: 5, usedCount: 0 }],
    };
    const result = applyMembership(membership, "haircut", 30000, now);
    expect(result.type).toBe("NONE");
  });

  it("uses a free included visit when available (spec: '5 Haircuts, 2 Facials')", () => {
    const membership = {
      discountPercent: 10,
      expiresAt: notExpired,
      benefits: [{ serviceId: "haircut", includedCount: 5, usedCount: 2 }],
    };
    const result = applyMembership(membership, "haircut", 30000, now);
    expect(result).toEqual({ type: "FREE_INCLUDED_VISIT", serviceId: "haircut", discountCents: 30000 });
  });

  it("falls back to the flat percent discount once included visits are used up", () => {
    const membership = {
      discountPercent: 10,
      expiresAt: notExpired,
      benefits: [{ serviceId: "haircut", includedCount: 5, usedCount: 5 }],
    };
    const result = applyMembership(membership, "haircut", 30000, now);
    expect(result).toEqual({ type: "PERCENT_DISCOUNT", discountPercent: 10, discountCents: 3000 });
  });

  it("applies the flat discount to a service with no included-visit benefit at all", () => {
    const membership = {
      discountPercent: 10,
      expiresAt: notExpired,
      benefits: [{ serviceId: "haircut", includedCount: 5, usedCount: 0 }],
    };
    const result = applyMembership(membership, "hair_spa", 120000, now);
    expect(result).toEqual({ type: "PERCENT_DISCOUNT", discountPercent: 10, discountCents: 12000 });
  });

  it("returns NONE when discount is 0% and no benefit applies", () => {
    const membership = { discountPercent: 0, expiresAt: notExpired, benefits: [] };
    const result = applyMembership(membership, "haircut", 30000, now);
    expect(result.type).toBe("NONE");
  });
});
