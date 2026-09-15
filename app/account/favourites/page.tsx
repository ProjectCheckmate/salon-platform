import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";

export default async function FavouritesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?next=/account/favourites");
  const userId = (session.user as any).id as string;

  const customer = await prisma.customerProfile.findUnique({ where: { userId } });
  const favourites = customer
    ? await prisma.favourite.findMany({
        where: { customerId: customer.id },
        include: { salon: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <main className="mx-auto max-w-2xl px-6 py-8 pb-20">
      <h1 className="mb-6 text-2xl font-semibold">My Favourite Salons</h1>

      {favourites.length === 0 && (
        <div className="rounded-xl border border-neutral-200 p-6 text-center">
          <p className="text-neutral-500">No favourites yet.</p>
          <Link href="/search" className="mt-3 inline-block text-sm font-medium text-blue-600">
            Find a Salon
          </Link>
        </div>
      )}

      <ul className="space-y-3">
        {favourites.map((f) => (
          <li key={f.id}>
            <Link
              href={`/salon/${f.salon.slug}`}
              className="block rounded-xl border border-neutral-200 p-4 hover:border-neutral-400"
            >
              <h3 className="font-medium">{f.salon.name}</h3>
              <p className="text-sm text-neutral-500">{f.salon.address}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
