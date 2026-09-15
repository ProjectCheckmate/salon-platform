import { describe, it, expect } from "vitest";
import { createAppointment, SlotUnavailableError } from "../createAppointment";

/**
 * Requires a real DATABASE_URL with migrations applied — this is an
 * integration test, not a unit test. Run with a disposable test DB:
 *   DATABASE_URL=postgresql://.../salon_test npx vitest run createAppointment
 *
 * Seed fixtures (a salon, staff, customer, service) before running —
 * see prisma/seed.ts for the pattern. IDs below are placeholders to
 * replace with your fixture's real IDs.
 */
describe.skipIf(!process.env.DATABASE_URL)("booking engine — concurrency (test case 10)", () => {
  it("only one of two simultaneous bookings for the same staff+time succeeds", async () => {
    const staffId = process.env.TEST_STAFF_ID!;
    const salonId = process.env.TEST_SALON_ID!;
    const customerAId = process.env.TEST_CUSTOMER_A_ID!;
    const customerBId = process.env.TEST_CUSTOMER_B_ID!;
    const serviceId = process.env.TEST_SERVICE_ID!;

    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 30 * 60 * 1000);

    const attempt = (customerId: string) =>
      createAppointment({
        salonId,
        customerId,
        staffId,
        startTime: start,
        endTime: end,
        services: [{ serviceId, priceCents: 30000, durationMinutes: 30 }],
        bookingType: "NORMAL",
        priorityFeeCents: 0,
        taxCents: 0,
      });

    const results = await Promise.allSettled([attempt(customerAId), attempt(customerBId)]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(SlotUnavailableError);
  });
});
