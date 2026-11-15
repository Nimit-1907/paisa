"use client";

import Link from "next/link";

import { IndianRupee, Search, User } from "lucide-react";

import { useDisplayName } from "@/components/profile-provider";
import { Button } from "@/components/ui/button";
import { HOME_PATH } from "@/lib/routes";

/**
 * The mark at the left of every header.
 *
 * Phones and tablets only. From `lg` up the sidebar carries the same mark a
 * few pixels to the left, and a second one beside it is the kind of
 * duplicate the header exists to avoid.
 */
export function HeaderLogo() {
  return (
    <Link
      href={HOME_PATH}
      aria-label="Paisa, go to records"
      className="bg-ink text-on-ink rounded-control pressable flex size-9 shrink-0 items-center justify-center lg:hidden"
    >
      <IndianRupee className="size-4" aria-hidden="true" />
    </Link>
  );
}

/**
 * Search, from any screen.
 *
 * Records searches in place and keeps its month and filters, so it passes
 * its own handler. Everywhere else this is a link to Records with the search
 * open, which is the same address the keyboard shortcut and the command
 * palette already use.
 */
export function HeaderSearch({ onSearch }: { onSearch?: () => void }) {
  if (onSearch) {
    return (
      <Button
        variant="ghost"
        size="icon-touch"
        aria-label="Search records"
        onClick={onSearch}
      >
        <Search className="size-5" aria-hidden="true" />
      </Button>
    );
  }

  return (
    <Button variant="ghost" size="icon-touch" asChild>
      <Link href="/records?search=1" aria-label="Search records">
        <Search className="size-5" aria-hidden="true" />
      </Link>
    </Button>
  );
}

/**
 * The avatar that opens More, with the user's initials.
 *
 * Lilac tint with a 1.5px ink border: the only control in the header that
 * is a destination rather than an action.
 */
export function HeaderProfile() {
  const name = useDisplayName();

  // Two letters at most. Somebody who has not set a name gets the icon:
  // a word in a 44px circle at 12px clips, and initials are what it means.
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <Link
      href="/more"
      // The initials are in the name as well as on the circle: WCAG 2.5.3 is
      // about what is drawn, and a label without the visible text is one
      // somebody using voice control cannot say.
      aria-label={
        initials
          ? `${initials}. Your profile and settings`
          : "Your profile and settings"
      }
      className="bg-tint-lilac text-text border-ink pressable flex size-11 shrink-0 items-center justify-center rounded-full border-[1.5px] text-xs font-bold"
    >
      {initials ? (
        <span aria-hidden="true">{initials}</span>
      ) : (
        <User className="size-4" aria-hidden="true" />
      )}
    </Link>
  );
}
