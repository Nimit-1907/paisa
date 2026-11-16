"use client";

import * as React from "react";

import { PageHeader } from "@/components/layout/page-header";

/**
 * A header that keeps the hero figure with you.
 *
 * Records and the account detail screen are both built around one number,
 * and on a phone that number is off the top of the screen after one flick,
 * so halfway down a long month you are reading rows with nothing to measure
 * them against. This takes the figure that scrolled away and puts a one-line
 * version of it in the sticky header.
 *
 * It wraps the hero rather than sitting next to it, because the thing worth
 * watching is the *bottom* of the hero: a sentinel placed there is the only
 * honest answer to "has the figure left the screen". An IntersectionObserver
 * on that one element costs nothing, where a scroll listener comparing
 * offsets runs on every frame of every scroll and still has to guess at the
 * header's own height.
 */
export function CollapsingHeader({
  title,
  description,
  actions,
  onSearch,
  monthNav,
  back,
  compact,
  children,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
  onSearch?: () => void;
  monthNav?: React.ComponentProps<typeof PageHeader>["monthNav"];
  back?: { href: string; label: string };
  /** The one-line version, shown once the hero is gone. */
  compact: React.ReactNode;
  /** The hero itself. */
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const sentinel = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const target = sentinel.current;
    if (!target || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Above the viewport, not merely out of it: scrolling *up* past the
        // hero on a short page would otherwise collapse the header too.
        setCollapsed(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      // The sticky header is about 56px tall plus the notch, so the hero has
      // really gone when its bottom edge passes that line rather than the
      // top of the window.
      { rootMargin: "-96px 0px 0px 0px", threshold: 0 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={actions}
        onSearch={onSearch}
        monthNav={monthNav}
        back={back}
        compact={compact}
        compactShown={collapsed}
      />
      {children}
      <div ref={sentinel} aria-hidden="true" className="h-px" />
    </>
  );
}
