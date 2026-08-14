import type { MetadataRoute } from "next";

import { getAppUrl } from "@/lib/app-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl = getAppUrl();
  const now = new Date();

  return [
    { url: `${appUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${appUrl}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${appUrl}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${appUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${appUrl}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${appUrl}/acceptable-use`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
