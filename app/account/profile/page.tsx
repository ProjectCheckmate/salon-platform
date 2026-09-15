import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";

const LINKS = [
  { href: "/account/bookings", label: "Bookings", icon: "📅" },
  { href: "/account/favourites", label: "Favourite Salons", icon: "❤️" },
  { href: "/account/memberships", label: "Memberships", icon: "🎟️" },
  { href: "/account/referrals", label: "Refer a Friend", icon: "🤝" },
  { href: "/account/wallet", label: "Wallet", icon: "💰" },
];

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?next=/account/profile");

  const user = await prisma.user.findUnique({
    where: { id: (session.user as any).id },
    select: { name: true, email: true, phone: true },
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-8 pb-20">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-200 text-xl font-medium">
          {(user?.name ?? "?").charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-semibold">{user?.name ?? "Your account"}</h1>
          <p className="text-sm text-neutral-500">{user?.email}</p>
          {user?.phone && <p className="text-sm text-neutral-500">{user.phone}</p>}
        </div>
      </div>

      <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50">
              <span className="text-lg">{link.icon}</span>
              <span className="text-sm font-medium">{link.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
