import { describe, it, expect } from "vitest";
import { isSelfReferral, isQualifyingBooking } from "../referralRules";

describe("isSelfReferral", () => {
  it("blocks the trivial case: identical email", () => {
    const result = isSelfReferral({
      referrerEmail: "person@example.com",
      referrerPhone: null,
      referredEmail: "Person@Example.com", // case-insensitive match
      referredPhone: null,
    });
    expect(result).toBe(true);
  });

  it("blocks the same phone number reused for a 'new' signup", () => {
    const result = isSelfReferral({
      referrerEmail: "a@example.com",
      referrerPhone: "9990001111",
      referredEmail: "b@example.com",
      referredPhone: "9990001111",
    });
    expect(result).toBe(true);
  });

  it("allows a genuinely different person", () => {
    const result = isSelfReferral({
      referrerEmail: "a@example.com",
      referrerPhone: "9990001111",
      referredEmail: "b@example.com",
      referredPhone: "8880002222",
    });
    expect(result).toBe(false);
  });

  it("does not false-positive when both phones are null", () => {
    const result = isSelfReferral({
      referrerEmail: "a@example.com",
      referrerPhone: null,
      referredEmail: "b@example.com",
      referredPhone: null,
    });
    expect(result).toBe(false);
  });
});

describe("isQualifyingBooking", () => {
  it("qualifies a completed, fully-paid appointment", () => {
    expect(isQualifyingBooking({ status: "COMPLETED", paymentStatus: "PAID" })).toBe(true);
  });

  it("does not qualify a cancelled appointment", () => {
    expect(isQualifyingBooking({ status: "CANCELLED", paymentStatus: "PAID" })).toBe(false);
  });

  it("does not qualify a completed but unpaid/partial appointment", () => {
    expect(isQualifyingBooking({ status: "COMPLETED", paymentStatus: "PARTIAL" })).toBe(false);
    expect(isQualifyingBooking({ status: "COMPLETED", paymentStatus: "UNPAID" })).toBe(false);
  });
});
