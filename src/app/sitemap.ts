import type { MetadataRoute } from "next";

import { getAbsoluteUrl } from "@/lib/app-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: getAbsoluteUrl("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: getAbsoluteUrl("/pricing"), lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: getAbsoluteUrl("/contact"), lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: getAbsoluteUrl("/privacy"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: getAbsoluteUrl("/terms"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: getAbsoluteUrl("/acceptable-use"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
