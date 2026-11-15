"use client";

import { IndianRupee, Vibrate } from "lucide-react";

import { setHaptics, setShowPaise } from "@/actions/profile";
import { PreferenceToggle } from "@/components/settings/preference-toggle";
import { haptic } from "@/lib/motion";

/**
 * The preferences that save themselves.
 *
 * No card of its own: these sit inside the screen's Preferences section,
 * beside the week start, because they are the same kind of thing — small
 * switches you judge by the result. They were a card at the bottom of the
 * screen, below the danger zone, which is the last place to put something
 * harmless.
 */
export function PreferencesCard({
  haptics,
  showPaise,
}: {
  haptics: boolean;
  showPaise: boolean;
}) {
  return (
    <div className="space-y-4">
      <PreferenceToggle
        icon={Vibrate}
        label="Haptic feedback"
        description="A light buzz when a record is saved or deleted. Phones only. Laptops and iPhones have no way to do it."
        enabled={haptics}
        onToggle={setHaptics}
        // On the way on, not on the way off: a buzz confirming that buzzing
        // is now switched off would be a strange thing to feel.
        onOptimistic={(next) => haptic(next)}
      />

      <PreferenceToggle
        icon={IndianRupee}
        label="Show paise in lists"
        description="Draws “.00” on amounts that have no paise. Real paise are always shown, whichever way this is set."
        enabled={showPaise}
        onToggle={setShowPaise}
      />
    </div>
  );
}
