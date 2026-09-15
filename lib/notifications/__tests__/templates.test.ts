import { describe, it, expect } from "vitest";
import * as templates from "../templates";

describe("notification templates", () => {
  it("bookingConfirmation includes all provided details", () => {
    const text = templates.bookingConfirmation({
      customerName: "Priya",
      salonName: "Royal Hair Studio",
      serviceName: "Haircut",
      dateTime: "Sep 12, 3:30 PM",
      priceRupees: 300,
    });
    expect(text).toContain("Priya");
    expect(text).toContain("Royal Hair Studio");
    expect(text).toContain("Haircut");
    expect(text).toContain("Sep 12, 3:30 PM");
    expect(text).toContain("300");
  });

  it("cancellationNotice omits the fee line when there's no fee", () => {
    const text = templates.cancellationNotice({
      customerName: "Priya",
      salonName: "Royal Hair Studio",
      dateTime: "Sep 12, 3:30 PM",
      feeRupees: 0,
    });
    expect(text).not.toContain("fee");
  });

  it("cancellationNotice includes the fee line when a fee applies", () => {
    const text = templates.cancellationNotice({
      customerName: "Priya",
      salonName: "Royal Hair Studio",
      dateTime: "Sep 12, 3:30 PM",
      feeRupees: 100,
    });
    expect(text).toContain("100");
    expect(text).toContain("fee");
  });

  it("rebookingReminder includes the real days-since-last-visit number, not a placeholder", () => {
    const text = templates.rebookingReminder({
      customerName: "Priya",
      salonName: "Royal Hair Studio",
      daysSinceLastVisit: 63,
    });
    expect(text).toContain("63");
  });

  it("every template exports a callable function (sanity check on the full spec-31 list)", () => {
    const expectedTemplates = [
      "bookingConfirmation",
      "appointmentReminder",
      "cancellationNotice",
      "reschedulingNotice",
      "paymentReceipt",
      "reviewRequest",
      "rebookingReminder",
      "inactiveCustomerCampaign",
      "birthdayOffer",
      "promotionalOffer",
      "emptySlotAlert",
    ];
    for (const name of expectedTemplates) {
      expect(typeof (templates as any)[name]).toBe("function");
    }
  });
});
