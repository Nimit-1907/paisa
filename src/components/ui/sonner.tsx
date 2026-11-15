"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";

/**
 * Toasts, in the Phase 14 language.
 *
 * The variables sonner reads were pointed at `--popover` and `--radius`,
 * neither of which this app defines — `--color-popover` is the Tailwind
 * theme key, not a raw custom property — so every toast was falling back to
 * sonner's own colours and sitting outside the design language entirely.
 * They are the raw tokens now, with the 14px toast radius.
 *
 * A hairline border rather than the ink edge: the hard-shadowed border is
 * reserved for the three places a selection lives (the segmented control,
 * a chosen tile, the dock's Add button), and a toast is not a selection.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        // A mint tile with an ink tick, the same square the rest of the
        // app puts an icon on. The toast is the only confirmation a save
        // gets, so its one piece of colour is worth drawing properly.
        success: (
          <span className="bg-tint-mint text-text flex size-6 shrink-0 items-center justify-center rounded-[9px]">
            <CircleCheckIcon className="size-3.5" />
          </span>
        ),
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--surface)",
          "--normal-text": "var(--text)",
          "--normal-border": "var(--hairline)",
          "--border-radius": "var(--radius-toast)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast text-sm",
          description: "text-text-secondary",
          // The undo in a toast is the only safety net behind a delete, so
          // it is an ink pill rather than a link — the same shape as the
          // primary button everywhere else.
          actionButton:
            "bg-ink! text-on-ink! rounded-control! h-8! px-3! text-xs! font-semibold!",
          cancelButton:
            "bg-surface-muted! text-text! rounded-full! h-8! px-3! text-xs! font-semibold!",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
