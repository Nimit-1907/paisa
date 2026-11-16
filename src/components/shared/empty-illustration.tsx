/**
 * The drawing on the system screens: 404.
 *
 * In-app empty states use the icon tile in EmptyState, one style for all of
 * them; this is for the full-page "you are not where you meant to be"
 * screens, which are a different kind of moment.
 *
 * Decorative: the heading beside it says what the screen is.
 */
export type EmptyArt = "lost";

export function EmptyIllustration({ art }: { art: EmptyArt }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 120 96"
      className="h-24 w-30"
      fill="none"
    >
      {/* The ground everything sits on, so the drawings share a horizon. */}
      <ellipse
        cx="60"
        cy="84"
        rx="34"
        ry="4"
        className="fill-muted-foreground/10"
      />
      {ART[art]}
    </svg>
  );
}

const stroke = "stroke-muted-foreground/60";
const accent = "stroke-primary";

const ART: Record<EmptyArt, React.ReactNode> = {
  // A signpost with one arm, pointing back the way you came. For the
  // system screens, 404 and an error, where the drawing's job is
  // to say "nothing is broken, you are just not where you meant to be".
  lost: (
    <g strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M60 30v50" className={stroke} />
      <path d="M36 36h40l8 8-8 8H36V36Z" className={`${stroke} fill-card`} />
      <path d="M46 44h18" className={accent} />
      <circle cx="60" cy="26" r="5" className="fill-primary/20 stroke-none" />
    </g>
  ),
};
