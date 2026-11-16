"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { CommandPalette } from "@/components/layout/command-palette";
import { useRecordSheet } from "@/components/records/record-sheet-provider";
import {
  isOverlayOpen,
  isPaletteKey,
  isPlainKey,
  isTypingTarget,
} from "@/lib/keyboard";

/**
 * The app's global keys.
 *
 *   ⌘K / Ctrl+K   the command palette
 *   N             a new record
 *   /             search your records
 *   Esc           close whatever is open
 *
 * The month arrows are not here: they live on the month stepper, because
 * that is the control they drive and on a screen without one the arrow keys
 * should go on meaning what the browser means by them.
 *
 * Esc is not here either. Radix and vaul both close on Esc already, and a
 * second handler would close the sheet *and* the thing behind it on one
 * press. The job here is only to not break it, which is what the
 * `isOverlayOpen` guard does.
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const sheet = useRecordSheet();
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isPaletteKey(event)) {
        // Chrome gives Ctrl+K to the address bar, so this has to be claimed.
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }

      // Everything below is a single letter, so it must never fire while
      // somebody is typing one, or while a sheet is on top of the page.
      if (!isPlainKey(event) || isTypingTarget(event.target)) return;
      if (isOverlayOpen()) return;

      if (event.key === "n" || event.key === "N") {
        if (!sheet.ready) return;
        event.preventDefault();
        sheet.openAdd();
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        // Search belongs to Records, so from anywhere else this is also a
        // navigation, and `?search=1` is what opens the field once it gets
        // there, whichever screen the keystroke came from.
        router.push("/records?search=1");
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [router, sheet]);

  return <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />;
}
