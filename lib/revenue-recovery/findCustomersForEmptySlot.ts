export type TimeOfDay = "morning" | "afternoon" | "evening";

export function timeOfDayFromHour(hour: number): TimeOfDay {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export interface CustomerBookingPattern {
  customerId: string;
  pastWeekdays: number[]; // weekday (0-6) of each of this customer's past appointments at this salon
  pastTimesOfDay: TimeOfDay[];
  pastServiceIds: string[];
  notificationsOptedIn: boolean;
}

export interface FreedSlot {
  weekday: number;
  hour: number;
  serviceId: string;
}

export interface SlotMatch {
  customerId: string;
  score: number; // higher = better match, for ranking who to notify first
}

/**
 * Finds customers likely to want a slot that just opened up (spec section
 * 32: prefers that weekday, that time of day, has used that service
 * before, and has opted into notifications). A customer needs ALL THREE
 * of weekday/time-of-day/service match to qualify at all — this is
 * deliberately conservative. A looser match (any one signal) would spam
 * people with irrelevant alerts, which spec section 30 explicitly warns
 * against ("Do not spam customers. Respect consent, opt-outs").
 */
export function findCustomersForEmptySlot(
  slot: FreedSlot,
  patterns: CustomerBookingPattern[]
): SlotMatch[] {
  const slotTimeOfDay = timeOfDayFromHour(slot.hour);
  const matches: SlotMatch[] = [];

  for (const pattern of patterns) {
    if (!pattern.notificationsOptedIn) continue;
    if (!pattern.pastServiceIds.includes(slot.serviceId)) continue;

    const weekdayMatches = pattern.pastWeekdays.filter((w) => w === slot.weekday).length;
    const timeOfDayMatches = pattern.pastTimesOfDay.filter((t) => t === slotTimeOfDay).length;
    if (weekdayMatches === 0 || timeOfDayMatches === 0) continue;

    matches.push({ customerId: pattern.customerId, score: weekdayMatches + timeOfDayMatches });
  }

  return matches.sort((a, b) => b.score - a.score);
}
