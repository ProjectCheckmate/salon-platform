import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import CancelButton from "./CancelButton";
import ReviewPrompt from "./ReviewPrompt";
import PayButton from "./PayButton";

export default async function MyBookingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?next=/account/bookings");

  const userId = (session.user as any).id as string;
  const customer = await prisma.customerProfile.findUnique({ where: { userId } });

  const appointments = customer
    ? await prisma.appointment.findMany({
        where: { customerId: customer.id },
        include: { salon: true, services: { include: { service: true } }, review: true },
        orderBy: { startTime: "desc" },
        take: 50,
      })
    : [];

  return (
    <main className="mx-auto max-w-2xl px-6 py-8 pb-20">
      <h1 className="mb-6 text-2xl font-semibold">My Bookings</h1>

      {appointments.length === 0 && (
        <div className="rounded-xl border border-neutral-200 p-6 text-center">
          <p className="text-neutral-500">No upcoming appointments</p>
          <a href="/search" className="mt-3 inline-block text-sm font-medium text-blue-600">
            Find a Salon
          </a>
        </div>
      )}

      <ul className="space-y-3">
        {appointments.map((a) => (
          <li key={a.id} className="rounded-xl border border-neutral-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium">{a.salon.name}</h3>
                <p className="text-sm text-neutral-500">
                  {a.services.map((s) => s.service.name).join(", ")}
                </p>
                <p className="mt-1 text-sm">
                  {new Date(a.startTime).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
                <p className="mt-1 text-xs uppercase tracking-wide text-neutral-400">
                  {a.status.replace("_", " ")} · {a.paymentStatus}
                </p>
              </div>
              {(a.status === "CONFIRMED" || a.status === "PENDING") && (
                <CancelButton appointmentId={a.id} />
              )}
            </div>
            {a.status === "COMPLETED" && !a.review && (
              <ReviewPrompt appointmentId={a.id} salonId={a.salonId} />
            )}
            {(a.status === "PENDING" || a.status === "CONFIRMED" || a.status === "COMPLETED") &&
              a.paymentStatus !== "PAID" && (
                <div className="mt-3">
                  <PayButton
                    appointmentId={a.id}
                    dueCents={a.totalAmountCents - a.paidAmountCents}
                    // The Razorpay KEY ID (not the secret) is safe to expose
                    // client-side — this is how Razorpay's own Checkout
                    // widget is designed to work. null here just means
                    // online payment isn't configured; the button then
                    // shows a friendly fallback message instead of erroring.
                    razorpayKeyId={process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? null}
                  />
                </div>
              )}
          </li>
        ))}
      </ul>
    </main>
  );
}
