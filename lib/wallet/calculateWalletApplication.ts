/**
 * A customer can request to use their wallet credit, but the amount
 * actually applied is capped by BOTH what they have and what they owe —
 * never more than either. This is the entire "don't let wallet balance go
 * negative and don't let a bill go negative" guarantee, in one place.
 */
export function calculateWalletApplication(
  walletBalanceCents: number,
  requestedCents: number,
  billCents: number
): number {
  if (walletBalanceCents <= 0 || requestedCents <= 0 || billCents <= 0) return 0;
  return Math.min(walletBalanceCents, requestedCents, billCents);
}
