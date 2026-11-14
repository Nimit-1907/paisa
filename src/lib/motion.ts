"use client";

import * as React from "react";

/**
 * The motion system.
 *
 * Two durations, one easing curve, and a single way to ask whether motion is
 * wanted at all. Everything here moves `transform` or `opacity` — the two
 * properties a browser can animate without laying the page out again — and
 * nothing in the app ever waits for an animation to finish before it does its
 * work.
 *
 * The feeling being aimed at is calm and in control. Motion earns its place
 * when it answers a question the user would otherwise have to ask: did that
 * register, where did that row go, is this number the same one as before.
 * Anything that is only decoration is not here.
 */

/** 120ms: feedback on something the user just touched. */
export const FAST = 120;

/** 200ms: something arriving, leaving, or changing shape. */
export const BASE = 200;

/** 400ms: the longest anything is allowed to take — a number counting up. */
export const COUNT_UP = 400;

/**
 * Decelerating, and the same curve everywhere.
 *
 * Fast at the start so the response feels immediate, settling at the end so
 * nothing snaps. A single curve is what makes separate animations read as one
 * system rather than as several.
 */
export const EASE = "cubic-bezier(0.2, 0, 0, 1)";

/** Tailwind classes for a row or button that should respond to a press. */
export const PRESSABLE =
  "transition-[transform,background-color] duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none active:scale-[0.97]";

/**
 * Whether the person has asked for less movement.
 *
 * Starts as `true` — assume reduced motion until the browser says otherwise.
 * The opposite default would play the animation once on the first render for
 * exactly the people who turned it off.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(true);

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/**
 * A number on its way to another number.
 *
 * Only for a figure that *changed while being looked at* — a month total
 * after a record is saved. It says "this is the same number as before, and it
 * moved", which is the one thing a straight swap cannot say.
 *
 * Minor units in and out, so nothing is ever rounded on the way through, and
 * the final frame is the exact value rather than something near it. The first
 * value is never animated: a page load is not a change.
 */
export function useCountUp(value: bigint, duration = COUNT_UP): bigint {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = React.useState(value);
  const from = React.useRef(value);
  const frame = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (reduced || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }

    const start = from.current;
    const span = value - start;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      // The same deceleration the CSS curve uses, so a number that moves
      // while a card resizes stays in step with it.
      const eased = 1 - Math.pow(1 - progress, 3);

      if (progress >= 1) {
        from.current = value;
        setShown(value);
        frame.current = null;
        return;
      }

      // Scaled integer arithmetic: money is BigInt, and going via a float
      // would round a large balance on every frame.
      setShown(start + (span * BigInt(Math.round(eased * 1000))) / 1000n);
      frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      // Whatever happens, the number on screen is the real one.
      from.current = value;
      setShown(value);
      frame.current = null;
    };
  }, [value, duration, reduced]);

  return shown;
}

/**
 * Zero for one frame, then the real value.
 *
 * What makes a progress bar fill rather than appear. Only on the way in: a
 * bar that re-ran its fill on every render would redraw itself every time
 * something unrelated on the screen changed, which is the difference between
 * a screen that is alive and one that is twitching.
 */
export function useFirstFill(value: number): number {
  const reduced = usePrefersReducedMotion();
  const [filled, setFilled] = React.useState(false);

  React.useEffect(() => {
    // Reduced motion: straight to the value, with no transition to animate
    // it, so it simply appears.
    if (reduced) {
      setFilled(true);
      return;
    }

    // Two frames: one for the browser to paint the empty bar, one for the
    // change to count as a transition rather than as the initial style.
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => setFilled(true)),
    );

    return () => cancelAnimationFrame(frame);
  }, [reduced]);

  /*
   * Empty until the effect has run, including on the server.
   *
   * Reading `reduced` here instead would start full — that hook assumes
   * reduced motion until the browser answers — and then drop to zero the
   * moment it answered "no", giving everyone who allows motion a
   * full-empty-full flash on every mount.
   */
  return filled ? value : 0;
}

/**
 * A short shake, for input that cannot be accepted.
 *
 * Returns a flag to put on the element and a function to set it off. Under
 * reduced motion it never fires — the caller shows the error outline and the
 * message, which is the part that actually explains the problem.
 */
export function useShake(): [boolean, () => void] {
  const reduced = usePrefersReducedMotion();
  const [shaking, setShaking] = React.useState(false);
  const timer = React.useRef<number | null>(null);

  React.useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const shake = React.useCallback(() => {
    if (reduced) return;

    setShaking(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShaking(false), 240);
  }, [reduced]);

  return [shaking, shake];
}

/**
 * A light tap on the phone, when the user has left it switched on.
 *
 * Confirmation you can feel without looking, for the two actions that change
 * data: saving and deleting. Silently does nothing on hardware or browsers
 * without a vibrator, which is most desktops and all of iOS Safari.
 */
export function haptic(enabled: boolean, pattern: number | number[] = 10) {
  if (!enabled) return;
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;

  try {
    navigator.vibrate(pattern);
  } catch {
    // A browser that exposes vibrate() and then refuses to use it is not
    // worth a broken save.
  }
}
