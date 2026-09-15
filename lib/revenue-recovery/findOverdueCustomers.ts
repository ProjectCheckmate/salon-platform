export interface CustomerVisitHistory {
  customerId: string;
  completedVisitDates: Date[]; // sorted or unsorted, ascending order not required
}

export interface OverdueCustomer {
  customerId: string;
  lastVisit: Date;
  averageIntervalDays: number;
  daysSinceLastVisit: number;
  daysOverdue: number; // daysSinceLastVisit - averageIntervalDays, only positive when flagged
}

/**
 * Flags a customer as overdue when they've gone noticeably longer than
 * their own typical gap between visits (spec section 29 example: visits
 * every 35 days, last visit 63 days ago -> OVERDUE). Needs at least 2
 * completed visits to establish a personal baseline interval — a customer
 * with only one visit has no pattern to compare against, so they're never
 * flagged by this function (a separate "first-visit follow-up" campaign
 * type, not this one, would cover them).
 *
 * `overdueMultiplier` controls how much slack to give before flagging —
 * 1.0 would flag the instant someone is one day late, which is too
 * aggressive; the default requires being at least 50% past their usual gap.
 */
export function findOverdueCustomers(
  histories: CustomerVisitHistory[],
  now: Date,
  overdueMultiplier = 1.5
): OverdueCustomer[] {
  const results: OverdueCustomer[] = [];

  for (const history of histories) {
    const dates = [...history.completedVisitDates].sort((a, b) => a.getTime() - b.getTime());
    if (dates.length < 2) continue;

    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      gaps.push((dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24));
    }
    const averageIntervalDays = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;

    const lastVisit = dates[dates.length - 1];
    const daysSinceLastVisit = (now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceLastVisit > averageIntervalDays * overdueMultiplier) {
      results.push({
        customerId: history.customerId,
        lastVisit,
        averageIntervalDays: Math.round(averageIntervalDays),
        daysSinceLastVisit: Math.round(daysSinceLastVisit),
        daysOverdue: Math.round(daysSinceLastVisit - averageIntervalDays),
      });
    }
  }

  // Most overdue first — that's who the owner should contact first.
  return results.sort((a, b) => b.daysOverdue - a.daysOverdue);
}
