import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // shadcn/ui imports from the `radix-ui` meta-package; without this every
    // page that pulls in a single primitive ships all of Radix.
    optimizePackageImports: ["radix-ui", "lucide-react", "date-fns"],
  },
};

export default nextConfig;
