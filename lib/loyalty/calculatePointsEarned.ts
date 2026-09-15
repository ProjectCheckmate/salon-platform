export interface LoyaltyRule {
  centsPerPoint: number; // e.g. 10000 (₹100) = 1 point, per spec section 35 example
}

export const DEFAULT_LOYALTY_RULE: LoyaltyRule = { centsPerPoint: 10000 };

/**
 * Points earned from a single paid amount. Always rounds DOWN (floor) —
 * a customer should never be credited for spend they haven't actually
 * crossed the threshold for, e.g. ₹150 at a ₹100/point rate earns 1 point,
 * not 1.5.
 */
export function calculatePointsEarned(amountCents: number, rule: LoyaltyRule = DEFAULT_LOYALTY_RULE): number {
  if (amountCents <= 0) return 0;
  return Math.floor(amountCents / rule.centsPerPoint);
}
