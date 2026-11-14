import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // shadcn/ui imports from the `radix-ui` meta-package; without this every
    // page that pulls in a single primitive ships all of Radix.
    optimizePackageImports: ["radix-ui", "lucide-react", "date-fns"],
  },
};

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // A service worker in dev caches aggressively and hides code changes.
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: true,
});

export default withSerwist(nextConfig);
