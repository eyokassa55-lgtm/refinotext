import type { MetadataRoute } from "next";

import { getAbsoluteUrl, PRODUCTION_APP_URL } from "@/lib/app-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard/", "/dashboard", "/sign-in", "/sign-up"],
    },
    sitemap: getAbsoluteUrl("/sitemap.xml"),
    host: PRODUCTION_APP_URL,
  };
}
