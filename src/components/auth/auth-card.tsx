import Link from "next/link";

import { IndianRupee } from "lucide-react";

/** The frame every auth screen shares: brand mark, title, form, footer line. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <Link
          href="/"
          aria-label="Paisa"
          className="bg-primary text-primary-foreground focus-visible:ring-ring mb-4 flex size-12 items-center justify-center rounded-2xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <IndianRupee className="size-6" aria-hidden="true" />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-muted-foreground mt-1.5 text-sm text-balance">
            {description}
          </p>
        ) : null}
      </div>

      {children}

      {footer ? (
        <div className="text-muted-foreground mt-6 text-center text-sm">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
