import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Where the browser may talk to besides this origin: Supabase, if a client
 * component ever reaches it directly (http for REST, ws for realtime).
 */
function supabaseOrigins(): string[] {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return [];
  try {
    const { origin, host, protocol } = new URL(url);
    return [origin, `${protocol === "https:" ? "wss" : "ws"}://${host}`];
  } catch {
    return [];
  }
}

/**
 * The policy every response carries.
 *
 * Scripts keep 'unsafe-inline' because Next's own bootstrap is inline and a
 * nonce would mean rendering every page dynamically through middleware.
 * What this does close: framing (the Delete account button cannot be
 * clickjacked), plugins, a rewritten <base>, forms posting elsewhere, and
 * fetches to anywhere but this origin and Supabase. Dev adds 'unsafe-eval'
 * and the HMR socket, which React's dev build needs.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigins().join(" ")}${isDev ? " ws: wss:" : ""}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
]
  .join("; ")
  .replace(/\s+;/g, ";");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // For browsers that predate frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // Ignored over plain http, so harmless on localhost; binding in production.
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]),
];

const nextConfig: NextConfig = {
  // "X-Powered-By: Next.js" tells a scanner which exploits to try first.
  poweredByHeader: false,
  experimental: {
    // shadcn/ui imports from the `radix-ui` meta-package; without this every
    // page that pulls in a single primitive ships all of Radix.
    optimizePackageImports: ["radix-ui", "lucide-react", "date-fns"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
