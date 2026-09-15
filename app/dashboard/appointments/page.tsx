import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import AppointmentRow from "./AppointmentRow";

export default async function OwnerAppointmentsPage({
  searchParams,
}: {
  searchParams: { salonId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?next=/dashboard/appointments");
  if (!searchParams.salonId) {
    return <main className="mx-auto max-w-3xl px-6 py-8">Missing ?salonId= in URL.</main>;
  }

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const appointments = await prisma.appointment.findMany({
    where: {
      salonId: searchParams.salonId,
      startTime: { gte: startOfDay, lt: endOfDay },
    },
    include: {
      customer: { include: { user: true } },
      staff: { include: { user: true } },
      services: { include: { service: true } },
    },
    orderBy: { startTime: "asc" },
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Today's Appointments</h1>

      {appointments.length === 0 && (
        <div className="rounded-xl border border-neutral-200 p-6 text-center text-neutral-500">
          No appointments today. Share your booking link to fill the calendar.
        </div>
      )}

      <ul className="space-y-3">
        {appointments.map((a) => (
          <AppointmentRow
            key={a.id}
            appointment={{
              id: a.id,
              customerName: a.customer.user.name ?? "Customer",
              staffName: a.staff.user.name ?? "Staff",
              services: a.services.map((s) => s.service.name),
              startTime: a.startTime.toISOString(),
              status: a.status,
              totalAmountCents: a.totalAmountCents,
              paidAmountCents: a.paidAmountCents,
              paymentStatus: a.paymentStatus,
            }}
          />
        ))}
      </ul>
    </main>
  );
}
