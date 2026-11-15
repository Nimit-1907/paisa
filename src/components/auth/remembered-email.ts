"use client";

/**
 * The address this browser signed in with last.
 *
 * A per-device convenience, which is exactly what `localStorage` is for: it
 * never leaves the device, it is not state the app relies on, and the screen
 * is correct without it. Everything is wrapped, because a private window or
 * blocked site data makes these accessors throw rather than return nothing —
 * and a sign-in page that crashes because it could not remember an email is
 * a worse outcome than not remembering it.
 *
 * Only the address. A password belongs in the browser's own password
 * manager, which the `autoComplete` attributes already hand it to.
 */
const KEY = "paisa:last-email";

export function rememberEmail(email: string): void {
  try {
    window.localStorage.setItem(KEY, email);
  } catch {
    // Nothing to do, and nothing lost.
  }
}

export function rememberedEmail(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function forgetEmail(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // As above.
  }
}
