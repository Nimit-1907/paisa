"use client";

import * as React from "react";

import { Delete } from "lucide-react";

import { useHaptic } from "@/components/profile-provider";
import { type AmountKey, pressKey } from "@/lib/amount";
import { PRESSABLE } from "@/lib/motion";
import { useHold } from "@/hooks/use-hold";
import { cn } from "@/lib/utils";

/**
 * The in-app number pad, the only way an amount is typed on a phone.
 *
 * Amount fields set `inputMode="none"`, so the device keyboard never rises
 * over a form that only needs ten digits; this takes its place. A physical
 * keyboard still types into the field directly.
 *
 * Two shapes:
 * - `inline`: always on screen, under the amount. The Add Record screen,
 *   where the amount is the thing being entered.
 * - `dock`: slides up from the bottom while an amount field has focus, with
 *   Done, the way a phone keyboard does. Every other amount field, on forms
 *   with more to them than the amount.
 *
 * Keys do not take focus (`pointerdown` is prevented), so the field keeps
 * its caret and a docked pad stays up between presses. Holding ⌫ clears.
 */
export function AmountKeypad({
  value,
  onChange,
  decimals,
  allowNegative = false,
  replace = false,
  variant = "inline",
  onDone,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  decimals: number;
  /** Adds ±, for an opening balance that can be below zero. */
  allowNegative?: boolean;
  /** The amount was filled in for the person: the next key starts over. */
  replace?: boolean;
  variant?: "inline" | "dock";
  /** The docked pad's Done key. */
  onDone?: () => void;
  className?: string;
}) {
  const tap = useHaptic();

  function press(key: AmountKey) {
    const next = pressKey(value, key, decimals, { allowNegative, replace });
    // A key that changes nothing still says it was pressed, once, quietly.
    tap(next === value ? 4 : 8);
    // Replacing reports even an unchanged value ("7" over "7"), so the
    // caller knows the prefilled amount has been taken over.
    if (next !== value || replace) onChange(next);
  }

  const point = decimals > 0 ? "." : null;

  if (variant === "inline") {
    return (
      <div
        role="group"
        aria-label="Keypad"
        className={cn("grid grid-cols-3 gap-1.5", className)}
      >
        {(["7", "8", "9", "4", "5", "6", "1", "2", "3"] as const).map(
          (digit) => (
            <Key key={digit} onPress={() => press(digit)}>
              {digit}
            </Key>
          ),
        )}
        {point ? (
          <Key onPress={() => press(".")} label="Decimal point">
            .
          </Key>
        ) : (
          <span aria-hidden="true" />
        )}
        <Key onPress={() => press("0")}>0</Key>
        <BackspaceKey
          onPress={() => press("back")}
          onHold={() => press("clear")}
        />
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Keypad"
      data-docked-keypad=""
      className={cn(
        "raised fixed inset-x-0 bottom-0 z-[60] border-t px-2 pt-2",
        "pb-[max(0.5rem,env(safe-area-inset-bottom))]",
        "animate-in slide-in-from-bottom-8 fade-in-0 duration-150 motion-reduce:animate-none",
        className,
      )}
    >
      <div className="mx-auto grid max-w-md grid-cols-4 gap-1.5">
        {(["7", "8", "9"] as const).map((digit) => (
          <Key key={digit} onPress={() => press(digit)}>
            {digit}
          </Key>
        ))}
        <BackspaceKey
          onPress={() => press("back")}
          onHold={() => press("clear")}
        />

        {(["4", "5", "6"] as const).map((digit) => (
          <Key key={digit} onPress={() => press(digit)}>
            {digit}
          </Key>
        ))}
        {allowNegative ? (
          <Key onPress={() => press("sign")} label="Plus or minus" muted>
            ±
          </Key>
        ) : (
          <span aria-hidden="true" />
        )}

        {(["1", "2", "3"] as const).map((digit) => (
          <Key key={digit} onPress={() => press(digit)}>
            {digit}
          </Key>
        ))}
        <button
          type="button"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => {
            tap(8);
            onDone?.();
          }}
          className={cn(
            PRESSABLE,
            "bg-ink text-on-ink rounded-control row-span-2 text-base font-semibold",
          )}
        >
          Done
        </button>

        <Key
          onPress={() => press("0")}
          className={point ? "col-span-2" : "col-span-3"}
        >
          0
        </Key>
        {point ? (
          <Key onPress={() => press(".")} label="Decimal point">
            .
          </Key>
        ) : null}
      </div>
    </div>
  );
}

const KEY = cn(
  PRESSABLE,
  "rounded-control flex items-center justify-center border select-none",
  "font-display text-2xl tabular-nums tracking-[-0.03em]",
  // Tall enough for a thumb at 44px, and taller when the screen has room:
  // a 4×4 pad at 56px is the whole bottom third of an 844px phone.
  "h-[clamp(44px,6.6dvh,56px)]",
  "hoverable:bg-surface-muted focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
);

function Key({
  onPress,
  label,
  muted = false,
  className,
  children,
}: {
  onPress: () => void;
  /** The accessible name, where the glyph is not one. */
  label?: string;
  muted?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      // Keeps focus (and the caret) in the amount field.
      onPointerDown={(event) => event.preventDefault()}
      onClick={onPress}
      className={cn(
        KEY,
        muted ? "bg-surface-muted text-text" : "bg-surface text-text",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** ⌫, which clears the whole amount when held for half a second. */
function BackspaceKey({
  onPress,
  onHold,
}: {
  onPress: () => void;
  onHold: () => void;
}) {
  const hold = useHold(onHold);

  return (
    <button
      type="button"
      aria-label="Delete last digit"
      title="Delete (hold to clear)"
      {...hold.handlers}
      onPointerDown={(event) => {
        // Keeps focus (and the caret) in the amount field.
        event.preventDefault();
        hold.handlers.onPointerDown();
      }}
      onClick={() => {
        // The hold already cleared; the click that ends it is not a second
        // delete.
        if (hold.wasHeld()) return;
        onPress();
      }}
      className={cn(KEY, "bg-surface-muted text-text")}
    >
      <Delete className="size-5" aria-hidden="true" />
    </button>
  );
}

/**
 * Whether this device's main pointer is a finger.
 *
 * The docked pad is for touch screens. With a mouse there is a physical
 * keyboard, and a pad rising over the form at every click into a field
 * would be in the way of the thing it replaces.
 */
export function useTouchKeypad(): boolean {
  const [touch, setTouch] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");
    const update = () => setTouch(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return touch;
}

/**
 * Focus state for a field with a docked pad.
 *
 * The pad is open while focus is in the field or on the pad itself (a
 * screen reader moves focus to a key to press it), and closes when it
 * leaves both. Spread `bind` on an element that contains the field and the
 * pad.
 */
export function useDockedKeypad() {
  const [open, setOpen] = React.useState(false);

  const bind = {
    onFocus: () => setOpen(true),
    onBlur: (event: React.FocusEvent<HTMLElement>) => {
      const next = event.relatedTarget as Node | null;
      if (next && event.currentTarget.contains(next)) return;
      setOpen(false);
    },
  };

  return { open, setOpen, bind };
}

/** The nearest ancestor that scrolls vertically, or the page. */
function scrollParent(node: HTMLElement): HTMLElement {
  let current = node.parentElement;
  while (current) {
    const { overflowY } = getComputedStyle(current);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      current.scrollHeight > current.clientHeight - 1
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return document.scrollingElement as HTMLElement;
}

/**
 * Keeps a field above the docked pad while it is open.
 *
 * The pad covers the bottom third of the screen, and a field down there
 * would be typed into blind. `scrollIntoView` is not enough on its own: a
 * sheet whose content ends just under the field cannot scroll far enough.
 * So the scrolling container gets room at the bottom the height of the pad,
 * then scrolls the field above it, and gives the room back on close.
 */
export function useKeepAboveKeypad(
  field: React.RefObject<HTMLElement | null>,
  open: boolean,
) {
  React.useEffect(() => {
    if (!open) return;
    const node = field.current;
    if (!node) return;

    let restore: (() => void) | null = null;
    const frame = window.requestAnimationFrame(() => {
      const pad = document.querySelector<HTMLElement>("[data-docked-keypad]");
      if (!pad) return;

      // Where the pad will rest, not where its slide-in has got to: it sits
      // on the bottom of the screen, so its top is its height up from there.
      const viewport = window.visualViewport?.height ?? window.innerHeight;
      const padTop = viewport - pad.offsetHeight;
      const bottom = node.getBoundingClientRect().bottom;
      // Room for the hint or error line a form row puts under its field.
      const overlap = bottom - padTop + 36;
      if (overlap <= 0) return;

      const scroller = scrollParent(node);
      const previous = scroller.style.paddingBottom;
      scroller.style.paddingBottom = `${pad.offsetHeight}px`;
      restore = () => {
        scroller.style.paddingBottom = previous;
      };
      scroller.scrollBy({ top: overlap, behavior: "smooth" });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      restore?.();
    };
  }, [field, open]);
}
