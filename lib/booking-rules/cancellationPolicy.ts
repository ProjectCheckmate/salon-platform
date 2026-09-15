export interface CancellationPolicy {
  freeWindowHours: number; // cancel this many hours before start = no fee
  lateFeeCents: number;
}

export const DEFAULT_CANCELLATION_POLICY: CancellationPolicy = {
  freeWindowHours: 4,
  lateFeeCents: 10000, // ₹100, matches spec section 21 example
};

export function calculateCancellationFee(
  appointmentStart: Date,
  now: Date,
  policy: CancellationPolicy = DEFAULT_CANCELLATION_POLICY
): number {
  const hoursUntilStart = (appointmentStart.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntilStart >= policy.freeWindowHours) return 0;
  return policy.lateFeeCents;
}
