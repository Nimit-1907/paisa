import type { MetadataRoute } from "next";

import { APP_PATHS, AUTH_PATHS, NEUTRAL_PATHS } from "@/lib/routes";
import { siteOrigin } from "@/lib/site";

/**
 * Crawl the public pages; leave the rest alone.
 *
 * The signed-in paths redirect to the login screen anyway, so a crawler would
 * only ever index a copy of that one page under ten URLs. The auth paths are
 * excluded for the same reason, a sign-up form is not a search result.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // A prefix, with no trailing slash: "/records" has to cover
      // "/records" itself as well as everything under it.
      disallow: [...APP_PATHS, ...AUTH_PATHS, ...NEUTRAL_PATHS],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
