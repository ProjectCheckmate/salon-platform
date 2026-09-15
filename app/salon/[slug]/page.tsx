import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import BookingWidget from "./BookingWidget";

// Only APPROVED salons ever get metadata generated or rendered here —
// a pending/rejected/suspended salon's page returns notFound() below,
// which also means it's correctly excluded from search engine indexing
// (a 404 page is never indexed) without needing separate noindex logic.
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const salon = await prisma.salon.findUnique({
    where: { slug: params.slug },
    select: { name: true, address: true, status: true, services: { where: { active: true }, select: { name: true }, take: 3 } },
  });

  if (!salon || salon.status !== "APPROVED") {
    return { title: "Salon not found" };
  }

  const serviceNames = salon.services.map((s) => s.name).join(", ");
  const description = `Book an appointment at ${salon.name}${salon.address ? ` in ${salon.address}` : ""}.${
    serviceNames ? ` Services: ${serviceNames}.` : ""
  }`;

  return {
    title: `${salon.name} — Book Online`,
    description,
    openGraph: { title: salon.name, description, type: "website" },
  };
}

export default async function SalonPage({ params }: { params: { slug: string } }) {
  const salon = await prisma.salon.findUnique({
    where: { slug: params.slug },
    include: {
      services: { where: { active: true } },
      staff: { where: { active: true }, include: { user: true } },
    },
  });

  if (!salon || salon.status !== "APPROVED") notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 pb-20">
      <h1 className="text-2xl font-semibold">{salon.name}</h1>
      <p className="text-neutral-500">{salon.address}</p>

      <BookingWidget
        salonId={salon.id}
        services={salon.services.map((s) => ({
          id: s.id,
          name: s.name,
          priceCents: s.priceCents,
          durationMinutes: s.durationMinutes,
          priorityAllowed: s.priorityAllowed,
        }))}
        staff={salon.staff.map((s) => ({ id: s.id, name: s.user.name ?? "Staff" }))}
      />
    </main>
  );
}
