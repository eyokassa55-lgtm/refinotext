import type { MetadataRoute } from "next";

import { getAbsoluteUrl } from "@/lib/app-url";
import { SITE_LAST_MODIFIED } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = SITE_LAST_MODIFIED;

  return [
    {
      url: getAbsoluteUrl("/"),
      lastModified,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: getAbsoluteUrl("/pricing"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: getAbsoluteUrl("/contact"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: getAbsoluteUrl("/privacy"),
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: getAbsoluteUrl("/terms"),
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: getAbsoluteUrl("/acceptable-use"),
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: getAbsoluteUrl("/refunds"),
      lastModified,
      changeFrequency: "yearly",
      priority: 0.4,
    },
  ];
}
