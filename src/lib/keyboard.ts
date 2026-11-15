/**
 * When a keyboard shortcut should keep its hands off.
 *
 * Single-letter shortcuts are the useful kind and the dangerous kind: "n" for
 * a new record is lovely until it fires while somebody is typing "naan" into
 * a note. Every handler in the app asks these two questions first.
 */

/** True when the keystroke belongs to whatever the user is typing in. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  if (target.isContentEditable) return true;

  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;

  // A listbox or a grid has its own idea of what the arrow keys mean.
  const role = target.getAttribute("role");
  return role === "textbox" || role === "combobox" || role === "listbox";
}

/**
 * True when a sheet, dialog, menu or the command palette is open.
 *
 * Asked of the DOM rather than tracked in state because the overlays come
 * from three different libraries — Radix dialogs, vaul drawers, cmdk — and
 * all three agree on this one thing: an open overlay has an element with
 * `role="dialog"` or `role="menu"` in the document. Tracking it ourselves
 * would mean every one of them remembering to report in.
 */
export function isOverlayOpen(): boolean {
  return (
    document.querySelector(
      '[role="dialog"], [role="alertdialog"], [role="menu"]',
    ) !== null
  );
}

/**
 * Whether a keystroke is a plain one — no Ctrl, Alt or Meta.
 *
 * Shift is allowed: "?" is Shift and "/" on most layouts, and refusing it
 * would make the search shortcut depend on the keyboard somebody owns.
 */
export function isPlainKey(event: KeyboardEvent): boolean {
  return !event.ctrlKey && !event.altKey && !event.metaKey;
}

/** Ctrl on Windows and Linux, ⌘ on a Mac — either opens the palette. */
export function isPaletteKey(event: KeyboardEvent): boolean {
  return event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
}
