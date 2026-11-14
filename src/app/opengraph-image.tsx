import { ImageResponse } from "next/og";

import { SITE } from "@/lib/site";

export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The card a shared link shows.
 *
 * Drawn here rather than shipped as a PNG so the words stay in one place with
 * the rest of the copy, and built from system fonts only — fetching a webfont
 * at build time makes the build need the network to succeed.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0b1016",
          color: "#f8fafc",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: "#22c55e",
              color: "#04120a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/*
              The rupee as a drawing rather than a character: the renderer
              only has the fonts it is given, and the one glyph the brand
              depends on is the one it would have had to fetch at build time.
              This is the same mark lucide draws in the app.
            */}
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#04120a"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 3h12" />
              <path d="M6 8h12" />
              <path d="m6 13 8.5 8" />
              <path d="M6 13h3" />
              <path d="M9 13c6.667 0 6.667-10 0-10" />
            </svg>
          </div>
          <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1 }}>
            {SITE.name}
          </div>
        </div>

        <div
          style={{
            marginTop: 48,
            fontSize: 76,
            fontWeight: 700,
            letterSpacing: -2,
            lineHeight: 1.05,
          }}
        >
          Know where the month went.
        </div>

        <div
          style={{
            marginTop: 28,
            fontSize: 32,
            color: "#94a3b8",
            maxWidth: 900,
            lineHeight: 1.3,
          }}
        >
          Log what you spend in four taps. Set a budget per category. See where
          it actually went.
        </div>
      </div>
    ),
    size,
  );
}
