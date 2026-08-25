import type { MetadataRoute } from "next";

import { getAbsoluteUrl } from "@/lib/app-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard/", "/dashboard", "/sign-in", "/sign-up"],
      },
    ],
    sitemap: getAbsoluteUrl("/sitemap.xml"),
  };
}
