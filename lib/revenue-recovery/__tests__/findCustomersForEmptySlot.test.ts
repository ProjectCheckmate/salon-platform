import { describe, it, expect } from "vitest";
import { findCustomersForEmptySlot, timeOfDayFromHour } from "../findCustomersForEmptySlot";

describe("timeOfDayFromHour", () => {
  it("classifies hours correctly", () => {
    expect(timeOfDayFromHour(9)).toBe("morning");
    expect(timeOfDayFromHour(14)).toBe("afternoon");
    expect(timeOfDayFromHour(19)).toBe("evening");
  });
});

describe("findCustomersForEmptySlot", () => {
  const slot = { weekday: 6, hour: 18, serviceId: "haircut" }; // Saturday evening haircut

  it("matches a customer whose history fits weekday + time + service", () => {
    const results = findCustomersForEmptySlot(slot, [
      {
        customerId: "c1",
        pastWeekdays: [6, 6],
        pastTimesOfDay: ["evening", "evening"],
        pastServiceIds: ["haircut"],
        notificationsOptedIn: true,
      },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].customerId).toBe("c1");
  });

  it("excludes a customer who hasn't opted into notifications, even with a perfect match", () => {
    const results = findCustomersForEmptySlot(slot, [
      {
        customerId: "c1",
        pastWeekdays: [6],
        pastTimesOfDay: ["evening"],
        pastServiceIds: ["haircut"],
        notificationsOptedIn: false,
      },
    ]);
    expect(results).toHaveLength(0);
  });

  it("excludes a customer who's never used this service", () => {
    const results = findCustomersForEmptySlot(slot, [
      {
        customerId: "c1",
        pastWeekdays: [6],
        pastTimesOfDay: ["evening"],
        pastServiceIds: ["facial"],
        notificationsOptedIn: true,
      },
    ]);
    expect(results).toHaveLength(0);
  });

  it("excludes a customer who matches service but not their usual weekday/time", () => {
    const results = findCustomersForEmptySlot(slot, [
      {
        customerId: "c1",
        pastWeekdays: [1, 2],
        pastTimesOfDay: ["morning"],
        pastServiceIds: ["haircut"],
        notificationsOptedIn: true,
      },
    ]);
    expect(results).toHaveLength(0);
  });

  it("ranks a stronger match (more matching visits) above a weaker one", () => {
    const results = findCustomersForEmptySlot(slot, [
      {
        customerId: "weak_match",
        pastWeekdays: [6, 1, 2, 3],
        pastTimesOfDay: ["evening", "morning", "morning", "morning"],
        pastServiceIds: ["haircut"],
        notificationsOptedIn: true,
      },
      {
        customerId: "strong_match",
        pastWeekdays: [6, 6, 6],
        pastTimesOfDay: ["evening", "evening", "evening"],
        pastServiceIds: ["haircut"],
        notificationsOptedIn: true,
      },
    ]);
    expect(results.map((r) => r.customerId)).toEqual(["strong_match", "weak_match"]);
  });
});
