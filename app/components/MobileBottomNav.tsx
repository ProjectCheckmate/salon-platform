"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/search", label: "Search", icon: "🔍" },
  { href: "/account/bookings", label: "Bookings", icon: "📅" },
  { href: "/account/favourites", label: "Favourites", icon: "❤️" },
  { href: "/account/profile", label: "Profile", icon: "👤" },
];

/**
 * Only rendered on mobile widths (hidden md:block on desktop via the
 * parent layout — see app/layout.tsx). This is the exact 5-item nav from
 * spec section 58: Home, Search, Bookings, Favourites, Profile.
 */
export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t border-neutral-200 bg-white md:hidden">
      {ITEMS.map((item) => {
        const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
              active ? "text-neutral-900" : "text-neutral-400"
            }`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
