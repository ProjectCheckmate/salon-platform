"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FavouriteButton({
  salonId,
  initiallyFavourited = false,
}: {
  salonId: string;
  initiallyFavourited?: boolean;
}) {
  const router = useRouter();
  const [favourited, setFavourited] = useState(initiallyFavourited);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault(); // don't trigger a wrapping <Link> navigation
    e.stopPropagation();
    setBusy(true);

    const res = await fetch(
      favourited ? `/api/favourites?salonId=${salonId}` : "/api/favourites",
      favourited
        ? { method: "DELETE" }
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ salonId }),
          }
    );

    if (res.ok) {
      setFavourited(!favourited);
      router.refresh();
    } else if (res.status === 401) {
      router.push("/login?next=/search");
    }
    setBusy(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-label={favourited ? "Remove from favourites" : "Add to favourites"}
      className="shrink-0 rounded-full p-1.5 text-lg leading-none disabled:opacity-50"
    >
      {favourited ? "❤️" : "🤍"}
    </button>
  );
}
