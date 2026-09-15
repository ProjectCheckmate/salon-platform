import { prisma } from "@/lib/db/prisma";
import type { MetadataRoute } from "next";

// Only APPROVED salons are listed — never leak a pending/suspended salon's
// URL into a sitemap that search engines and scrapers will crawl.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const salons = await prisma.salon.findMany({
    where: { status: "APPROVED" },
    select: { slug: true, updatedAt: true },
  });

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  return [
    { url: baseUrl, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/search`, changeFrequency: "daily", priority: 0.8 },
    ...salons.map((s) => ({
      url: `${baseUrl}/salon/${s.slug}`,
      lastModified: s.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
