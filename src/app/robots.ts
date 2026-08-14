import type { MetadataRoute } from "next";

import { getAppUrl } from "@/lib/app-url";

export default function robots(): MetadataRoute.Robots {
  const appUrl = getAppUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard"],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
