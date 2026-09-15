import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/permissions";
import { logAudit } from "@/lib/audit/logAudit";
import { withAuthErrors } from "@/lib/api/withAuthErrors";

const bodySchema = z.object({
  name: z.string().min(2).max(120),
  address: z.string().min(5),
  phone: z.string().min(6),
  latitude: z.number(),
  longitude: z.number(),
});

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") +
    "-" +
    Math.random().toString(36).slice(2, 7)
  );
}

// Only signed-in OWNER (or ADMIN, for support purposes) can submit a salon.
// A CUSTOMER account cannot create salons through this route.
export const POST = withAuthErrors(async function POST(req: NextRequest) {
  const session = await requireRole("OWNER", "ADMIN");
  const ownerId = (session.user as any).id as string;

  const json = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name, address, phone, latitude, longitude } = parsed.data;

  const salon = await prisma.salon.create({
    data: {
      name,
      slug: slugify(name),
      address,
      phone,
      latitude,
      longitude,
      ownerId,
      status: "PENDING",
      application: {
        create: { status: "PENDING" },
      },
    },
    include: { application: true },
  });

  await logAudit({
    actorId: ownerId,
    action: "SALON_SUBMITTED",
    entity: "Salon",
    entityId: salon.id,
  });

  return NextResponse.json({ salon }, { status: 201 });
});

// GET /api/salons?lat=..&lng=..&radiusKm=.. -> public discovery, APPROVED only
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  const q = searchParams.get("q")?.trim();

  const where: any = { status: "APPROVED" };
  if (q) {
    where.name = { contains: q, mode: "insensitive" };
  }

  const salons = await prisma.salon.findMany({
    where,
    select: {
      id: true,
      slug: true,
      name: true,
      address: true,
      latitude: true,
      longitude: true,
      services: {
        where: { active: true },
        select: { priceCents: true },
        orderBy: { priceCents: "asc" },
        take: 1,
      },
    },
    take: 50,
  });

  const withDistance = salons.map((s) => ({
    ...s,
    distanceKm:
      !isNaN(lat) && !isNaN(lng) && s.latitude != null && s.longitude != null
        ? haversineKm(lat, lng, s.latitude, s.longitude)
        : null,
  }));

  if (!isNaN(lat) && !isNaN(lng)) {
    withDistance.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  }

  return NextResponse.json({ salons: withDistance });
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}
