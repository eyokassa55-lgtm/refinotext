import type { MetadataRoute } from "next";

import { getAbsoluteUrl } from "@/lib/app-url";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: getAbsoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: getAbsoluteUrl("/pricing"), changeFrequency: "monthly", priority: 0.8 },
    { url: getAbsoluteUrl("/contact"), changeFrequency: "yearly", priority: 0.4 },
    { url: getAbsoluteUrl("/privacy"), changeFrequency: "yearly", priority: 0.3 },
    { url: getAbsoluteUrl("/terms"), changeFrequency: "yearly", priority: 0.3 },
    { url: getAbsoluteUrl("/acceptable-use"), changeFrequency: "yearly", priority: 0.3 },
  ];
}
