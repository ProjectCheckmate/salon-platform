export interface CouponData {
  type: "PERCENTAGE" | "FIXED";
  value: number; // percent (0-100) if PERCENTAGE, cents if FIXED
  maxUsesTotal: number | null;
  currentUsesTotal: number;
  maxUsesPerCustomer: number;
  currentUsesByThisCustomer: number;
  minSpendCents: number;
  validFrom: Date;
  validUntil: Date | null;
  active: boolean;
}

export type CouponResult =
  | { valid: true; discountCents: number }
  | { valid: false; reason: string };

/**
 * Every rejection reason is returned as a distinct string so the booking
 * UI can show the customer something specific ("This coupon has expired")
 * instead of a generic "invalid coupon" — spec section 34 lists usage
 * limits and validity windows as first-class fields, implying customers
 * should understand why a code didn't work.
 */
export function applyCoupon(coupon: CouponData, subtotalCents: number, now: Date): CouponResult {
  if (!coupon.active) return { valid: false, reason: "This coupon is no longer active." };
  if (now < coupon.validFrom) return { valid: false, reason: "This coupon isn't valid yet." };
  if (coupon.validUntil && now > coupon.validUntil) {
    return { valid: false, reason: "This coupon has expired." };
  }
  if (coupon.maxUsesTotal != null && coupon.currentUsesTotal >= coupon.maxUsesTotal) {
    return { valid: false, reason: "This coupon has reached its usage limit." };
  }
  if (coupon.currentUsesByThisCustomer >= coupon.maxUsesPerCustomer) {
    return { valid: false, reason: "You've already used this coupon." };
  }
  if (subtotalCents < coupon.minSpendCents) {
    return {
      valid: false,
      reason: `This coupon requires a minimum spend of Rs.${(coupon.minSpendCents / 100).toFixed(0)}.`,
    };
  }

  const discountCents =
    coupon.type === "PERCENTAGE"
      ? Math.round((subtotalCents * coupon.value) / 100)
      : Math.min(coupon.value, subtotalCents); // a fixed discount can never exceed the bill itself

  return { valid: true, discountCents };
}
