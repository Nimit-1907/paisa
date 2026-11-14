import type { MetadataRoute } from "next";

import { siteOrigin } from "@/lib/site";

/** Only the four pages a signed-out visitor can actually read. */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  const lastModified = new Date();

  return [
    { url: `${origin}/`, lastModified, changeFrequency: "monthly", priority: 1 },
    {
      url: `${origin}/features`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${origin}/faq`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${origin}/privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
