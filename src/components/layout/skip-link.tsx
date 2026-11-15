/**
 * Skip to content.
 *
 * The sidebar on a wide screen puts five tab links in front of the page every
 * time it loads, and the bottom nav does the same for a screen reader on a
 * phone. One Tab should be able to get past them.
 *
 * Visible only while focused, and positioned over the sticky header rather
 * than pushing it down, so it does not shift the layout when it appears.
 */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="bg-background text-text sr-only rounded-lg border px-4 py-2 text-sm font-semibold shadow-lg focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-50  "
    >
      Skip to content
    </a>
  );
}
