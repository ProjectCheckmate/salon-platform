import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";

export default async function MyMembershipsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?next=/account/memberships");
  const userId = (session.user as any).id as string;

  const customer = await prisma.customerProfile.findUnique({ where: { userId } });
  const purchases = customer
    ? await prisma.membershipPurchase.findMany({
        where: { customerId: customer.id },
        include: {
          membership: { include: { salon: true, benefits: { include: { service: true } } } },
          usages: true,
        },
        orderBy: { purchasedAt: "desc" },
      })
    : [];

  return (
    <main className="mx-auto max-w-2xl px-6 py-8 pb-20">
      <h1 className="mb-6 text-2xl font-semibold">My Memberships</h1>

      {purchases.length === 0 && <p className="text-neutral-500">No memberships yet.</p>}

      <ul className="space-y-4">
        {purchases.map((p) => {
          const expired = p.expiresAt < new Date();
          return (
            <li key={p.id} className="rounded-xl border border-neutral-200 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-medium">{p.membership.name}</h2>
                  <p className="text-sm text-neutral-500">{p.membership.salon.name}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    expired ? "bg-neutral-100 text-neutral-500" : "bg-green-100 text-green-700"
                  }`}
                >
                  {expired ? "Expired" : `Valid till ${p.expiresAt.toLocaleDateString()}`}
                </span>
              </div>

              <ul className="mt-3 space-y-1 text-sm">
                {p.membership.benefits.map((b) => {
                  const used = p.usages.filter((u) => u.serviceId === b.serviceId).length;
                  return (
                    <li key={b.id} className="flex justify-between">
                      <span>{b.service.name}</span>
                      <span className="text-neutral-500">
                        {Math.max(b.includedCount - used, 0)} of {b.includedCount} remaining
                      </span>
                    </li>
                  );
                })}
                {p.membership.discountPercent > 0 && (
                  <li className="flex justify-between text-neutral-500">
                    <span>All other services</span>
                    <span>{p.membership.discountPercent}% off</span>
                  </li>
                )}
              </ul>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
