export interface MembershipBenefitRemaining {
  serviceId: string;
  includedCount: number;
  usedCount: number;
}

export interface ActiveMembership {
  discountPercent: number;
  expiresAt: Date;
  benefits: MembershipBenefitRemaining[];
}

export type MembershipApplication =
  | { type: "FREE_INCLUDED_VISIT"; serviceId: string; discountCents: number }
  | { type: "PERCENT_DISCOUNT"; discountPercent: number; discountCents: number }
  | { type: "NONE"; discountCents: 0 };

/**
 * Decides how (if at all) an active membership reduces the price of one
 * service in a booking. Included-visit benefits ("5 Haircuts") are checked
 * and preferred over the flat percentage discount, since spec section 36's
 * example bundles specific included visits AND a discount together — using
 * up a free visit is normally the better deal for the customer than 10% off.
 */
export function applyMembership(
  membership: ActiveMembership | null,
  serviceId: string,
  basePriceCents: number,
  now: Date
): MembershipApplication {
  if (!membership) return { type: "NONE", discountCents: 0 };
  if (membership.expiresAt < now) return { type: "NONE", discountCents: 0 };

  const benefit = membership.benefits.find((b) => b.serviceId === serviceId);
  if (benefit && benefit.usedCount < benefit.includedCount) {
    return { type: "FREE_INCLUDED_VISIT", serviceId, discountCents: basePriceCents };
  }

  if (membership.discountPercent > 0) {
    const discountCents = Math.round((basePriceCents * membership.discountPercent) / 100);
    return { type: "PERCENT_DISCOUNT", discountPercent: membership.discountPercent, discountCents };
  }

  return { type: "NONE", discountCents: 0 };
}
