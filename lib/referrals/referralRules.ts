export interface ReferralSignupCheck {
  referrerEmail: string;
  referrerPhone: string | null;
  referredEmail: string;
  referredPhone: string | null;
}

/**
 * The most basic and most important abuse check: a person cannot refer
 * themselves to farm the reward, whether they use the same email or the
 * same phone number for a "new" signup (spec section 37: "Prevent obvious
 * abuse"). This doesn't catch every possible abuse pattern (e.g. a genuine
 * second person sharing a household phone), but it stops the trivial case.
 */
export function isSelfReferral(check: ReferralSignupCheck): boolean {
  const sameEmail = check.referrerEmail.toLowerCase().trim() === check.referredEmail.toLowerCase().trim();
  const samePhone =
    !!check.referrerPhone && !!check.referredPhone && check.referrerPhone === check.referredPhone;
  return sameEmail || samePhone;
}

/**
 * The reward is only earned once the referred person completes a real,
 * PAID, COMPLETED appointment — not merely for signing up (spec section 37:
 * "Both receive ₹100 reward" is described alongside "Track: referrer,
 * referred customer, booking, reward status", implying the booking is what
 * triggers it). A cancelled or unpaid "booking" earns nothing.
 */
export function isQualifyingBooking(appointment: { status: string; paymentStatus: string }): boolean {
  return appointment.status === "COMPLETED" && appointment.paymentStatus === "PAID";
}
