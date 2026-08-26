import type { MetadataRoute } from "next";

import { getAbsoluteUrl, PRODUCTION_APP_URL } from "@/lib/app-url";

const privatePaths = [
  "/api/",
  "/dashboard/",
  "/dashboard",
  "/sign-in",
  "/sign-up",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: privatePaths,
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: privatePaths,
      },
    ],
    sitemap: getAbsoluteUrl("/sitemap.xml"),
    host: PRODUCTION_APP_URL,
  };
}
