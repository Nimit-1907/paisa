"use client";

import * as React from "react";

import { Download, Share, SquarePlus } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * The event Chromium fires when a site is installable. It is not in the DOM
 * typings because no other engine implements it.
 */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * "Add to home screen", in whichever form the browser allows.
 *
 * Chromium hands over an event that can be re-fired on a tap, which is the
 * good case. Safari does not: on iOS the only route is the Share menu, so the
 * honest thing is to say where it is rather than show a button that cannot
 * work.
 *
 * Nothing is shown at all when the app is already installed, or in a browser
 * that offers neither path.
 */
export function InstallButton() {
  const [prompt, setPrompt] = React.useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = React.useState(false);
  const [isIos, setIsIos] = React.useState(false);

  React.useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // Safari's own flag, which predates the media query.
      (window.navigator as { standalone?: boolean }).standalone === true;

    setInstalled(standalone);

    // iPad has reported itself as a Mac since iPadOS 13, so touch support is
    // part of the test.
    setIsIos(
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    );

    const onPrompt = (event: Event) => {
      // Chromium shows its own mini-infobar otherwise, and the point of this
      // is to put the choice somewhere the user can find it later.
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  if (prompt) {
    return (
      <Button
        variant="outline"
        size="touch"
        className="w-full"
        onClick={() => {
          void prompt.prompt().then(() => setPrompt(null));
        }}
      >
        <Download className="size-4" aria-hidden="true" />
        Add Paisa to your home screen
      </Button>
    );
  }

  if (isIos) {
    return (
      <p className="text-muted-foreground bg-card flex items-start gap-2 rounded-xl border p-3 text-xs">
        <SquarePlus className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          To install Paisa, tap{" "}
          <Share className="inline size-3.5 align-text-bottom" aria-hidden="true" />{" "}
          <span className="font-semibold">Share</span> and then{" "}
          <span className="font-semibold">Add to Home Screen</span>.
        </span>
      </p>
    );
  }

  return null;
}
