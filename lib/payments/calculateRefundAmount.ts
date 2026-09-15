/**
 * How much to refund when a paid appointment is cancelled: whatever was
 * actually paid, minus the cancellation fee (from cancellationPolicy.ts),
 * never negative. This is deliberately its own pure function rather than
 * folded into the cancel route inline, so the money math is independently
 * testable from the DB/HTTP plumbing around it.
 */
export function calculateRefundAmount(paidCents: number, cancellationFeeCents: number): number {
  if (paidCents <= 0) return 0;
  return Math.max(paidCents - cancellationFeeCents, 0);
}
