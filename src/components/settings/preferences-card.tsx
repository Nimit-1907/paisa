"use client";

import { IndianRupee, Vibrate } from "lucide-react";

import { setHaptics, setShowPaise } from "@/actions/profile";
import { PreferenceToggle } from "@/components/settings/preference-toggle";
import { haptic } from "@/lib/motion";

/**
 * The preferences that save themselves.
 *
 * One card rather than two, because they are the same kind of thing — small
 * switches you judge by the result — and two cards with one row each is a
 * settings screen that looks longer than it is.
 */
export function PreferencesCard({
  haptics,
  showPaise,
}: {
  haptics: boolean;
  showPaise: boolean;
}) {
  return (
    <section className="bg-card rounded-card space-y-4 border p-4">
      <PreferenceToggle
        icon={Vibrate}
        label="Haptic feedback"
        description="A light buzz when a record is saved or deleted. Phones only — laptops and iPhones have no way to do it."
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
    </section>
  );
}
