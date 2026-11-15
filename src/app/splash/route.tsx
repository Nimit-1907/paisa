import { ImageResponse } from "next/og";

import { isKnownSplash } from "@/lib/splash";

/**
 * One iOS launch screen, at the size that was asked for.
 *
 * The same mark and wordmark as the app icon on the app's own background, so
 * the moment between tapping the icon and the first screen looks like part of
 * the app rather than a gap in it. Sizes are checked against the list this
 * app actually links to: an open image generator is a way to spend somebody
 * else's CPU.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const width = Number(params.get("w"));
  const height = Number(params.get("h"));

  if (!isKnownSplash(width, height)) {
    return new Response("Unknown size", { status: 404 });
  }

  const unit = Math.round(width / 6);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: unit / 3,
        // The light theme's page, written out: this is rendered at the
        // edge, where no stylesheet exists. It was still slate.
        background: "#f6f6f4",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          width: unit,
          height: unit,
          borderRadius: unit / 3.5,
          background: "#141414",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* The rupee as a path: the renderer has no font with that glyph. */}
        <svg
          width={unit * 0.55}
          height={unit * 0.55}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
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

      <div
        style={{
          fontSize: unit / 3,
          fontWeight: 600,
          letterSpacing: -1,
          color: "#1e293b",
        }}
      >
        Paisa
      </div>
    </div>,
    { width, height },
  );
}
