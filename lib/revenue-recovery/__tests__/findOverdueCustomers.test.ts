import { describe, it, expect } from "vitest";
import { findOverdueCustomers } from "../findOverdueCustomers";

const DAY = 24 * 60 * 60 * 1000;

describe("findOverdueCustomers", () => {
  it("flags the exact spec example: visits every ~35 days, last visit 63 days ago", () => {
    const now = new Date("2026-09-05T00:00:00Z");
    // Simulate a customer with a consistent ~35 day cadence, most recent visit 63 days ago
    const lastVisit = new Date(now.getTime() - 63 * DAY);
    const visitBefore = new Date(lastVisit.getTime() - 35 * DAY);
    const visitBeforeThat = new Date(visitBefore.getTime() - 35 * DAY);

    const results = findOverdueCustomers(
      [{ customerId: "cust_1", completedVisitDates: [visitBeforeThat, visitBefore, lastVisit] }],
      now
    );

    expect(results).toHaveLength(1);
    expect(results[0].customerId).toBe("cust_1");
    expect(results[0].averageIntervalDays).toBe(35);
    expect(results[0].daysSinceLastVisit).toBe(63);
  });

  it("does not flag a customer who is on schedule", () => {
    const now = new Date("2026-09-05T00:00:00Z");
    const lastVisit = new Date(now.getTime() - 20 * DAY); // well within their ~30 day cadence
    const visitBefore = new Date(lastVisit.getTime() - 30 * DAY);
    const visitBeforeThat = new Date(visitBefore.getTime() - 30 * DAY);

    const results = findOverdueCustomers(
      [{ customerId: "cust_2", completedVisitDates: [visitBeforeThat, visitBefore, lastVisit] }],
      now
    );
    expect(results).toHaveLength(0);
  });

  it("never flags a customer with fewer than 2 visits (no pattern to compare against)", () => {
    const now = new Date("2026-09-05T00:00:00Z");
    const oneVisit = new Date(now.getTime() - 500 * DAY);
    const results = findOverdueCustomers(
      [{ customerId: "cust_3", completedVisitDates: [oneVisit] }],
      now
    );
    expect(results).toHaveLength(0);
  });

  it("sorts most-overdue first", () => {
    const now = new Date("2026-09-05T00:00:00Z");
    function makeHistory(id: string, intervalDays: number, daysSinceLast: number) {
      const last = new Date(now.getTime() - daysSinceLast * DAY);
      const before = new Date(last.getTime() - intervalDays * DAY);
      const beforeThat = new Date(before.getTime() - intervalDays * DAY);
      return { customerId: id, completedVisitDates: [beforeThat, before, last] };
    }
    const results = findOverdueCustomers(
      [makeHistory("slightly_late", 30, 50), makeHistory("very_late", 30, 120)],
      now
    );
    expect(results.map((r) => r.customerId)).toEqual(["very_late", "slightly_late"]);
  });
});
