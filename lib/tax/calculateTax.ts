/**
 * Tax is calculated on the DISCOUNTED subtotal, not the pre-discount
 * price — this matches how GST and most sales tax regimes actually work
 * (you don't pay tax on a discount you never paid). Order matters: apply
 * coupon/membership discounts first, then tax on what's left.
 */
export function calculateTax(subtotalAfterDiscountCents: number, taxPercent: number): number {
  if (taxPercent <= 0 || subtotalAfterDiscountCents <= 0) return 0;
  return Math.round((subtotalAfterDiscountCents * taxPercent) / 100);
}
