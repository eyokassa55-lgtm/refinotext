import type { MetadataRoute } from "next";

import { getAbsoluteUrl, PRODUCTION_APP_URL } from "@/lib/app-url";

export const revalidate = 3600;

export default function robots(): MetadataRoute.Robots {
  const host = new URL(PRODUCTION_APP_URL).host;

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard"],
    },
    sitemap: getAbsoluteUrl("/sitemap.xml"),
    host,
  };
}
