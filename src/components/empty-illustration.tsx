/**
 * The drawings on empty screens.
 *
 * Four small line illustrations in the app's own palette, drawn here as SVG
 * rather than fetched as images: they take their colour from the theme, stay
 * sharp at any density, and cost nothing to load. Each one is a flattened,
 * friendlier version of the thing the screen is about — a receipt, a target,
 * a wallet, a repeat — so the empty state reads as "nothing here yet" rather
 * than "something went wrong".
 *
 * All of them are decorative: the heading beside them says what the screen
 * is, so there is nothing here for a screen reader to gain.
 */
export type EmptyArt = "records" | "budgets" | "accounts" | "recurring" | "analysis";

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
  // A receipt with a torn edge and two lines on it.
  records: (
    <g strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M42 20h36v56l-6-5-6 5-6-5-6 5-6-5-6 5V20Z"
        className={`${stroke} fill-card`}
      />
      <path d="M51 35h18M51 46h12" className={stroke} />
      <circle cx="78" cy="24" r="9" className="fill-primary/15 stroke-none" />
      <path d="M74 24h8M78 20v8" className={accent} />
    </g>
  ),
  // A target with the arrow already in it.
  budgets: (
    <g strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="60" cy="46" r="26" className={`${stroke} fill-card`} />
      <circle cx="60" cy="46" r="16" className={stroke} />
      <circle cx="60" cy="46" r="6" className="fill-primary/20 stroke-none" />
      <path d="M60 46 84 22" className={accent} />
      <path d="M78 22h6v6" className={accent} />
    </g>
  ),
  // A wallet with a card leaving it.
  accounts: (
    <g strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M34 34h52a4 4 0 0 1 4 4v30a4 4 0 0 1-4 4H34a4 4 0 0 1-4-4V38a4 4 0 0 1 4-4Z"
        className={`${stroke} fill-card`}
      />
      <path d="M70 48h16v12H70a6 6 0 0 1 0-12Z" className={accent} />
      <path d="M38 34l34-12 6 12" className={stroke} />
    </g>
  ),
  // Two arrows going round.
  recurring: (
    <g strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="60" cy="46" r="24" className="fill-card stroke-none" />
      <path d="M40 40a22 22 0 0 1 38-8" className={stroke} />
      <path d="M80 42V30h-12" className={accent} />
      <path d="M80 52a22 22 0 0 1-38 8" className={stroke} />
      <path d="M40 50v12h12" className={accent} />
    </g>
  ),
  // Three bars, one of them still growing.
  analysis: (
    <g strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M34 72V48" className={stroke} />
      <path d="M48 72V32" className={stroke} />
      <path d="M62 72V56" className={stroke} />
      <path d="M76 72V40" className={accent} />
      <path d="M28 72h64" className={stroke} />
    </g>
  ),
};
