import type { MetadataRoute } from "next";

// Customer-facing marketplace pages are crawlable; everything account-,
// dashboard-, and API-scoped is explicitly disallowed — none of that is
// meant to be indexed, and some of it (customer bookings, invoices) would
// be a privacy problem if it were.
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/search", "/salon/"],
      disallow: ["/api/", "/dashboard/", "/account/", "/admin/", "/owner/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
