"use client";

import * as React from "react";

import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";

/** How long before offering to send it again. */
const RESEND_AFTER = 30;

/**
 * The panel both mail-sending screens end on.
 *
 * It names the address it sent to. "Check your email" is useless if you have
 * three of them, and it is the one moment somebody can still notice a typo —
 * seeing `nimt@…` on screen is what turns a dead end into a correction.
 *
 * Resend is offered after thirty seconds rather than immediately. Straight
 * away it would mostly be pressed by people whose mail simply had not
 * arrived yet, which spends their rate limit on a second copy of an email
 * already in flight. The countdown says when, so the wait is not a mystery.
 *
 * The Mailpit pointer only renders in development — in production there is no
 * such inbox, and telling users about one would be nonsense.
 */
export function CheckEmailNotice({
  title = "Check your email",
  email,
  onResend,
  children,
}: {
  title?: string;
  /** Shown back, so a typo is catchable. */
  email?: string;
  /** Omitted where there is nothing to send again. */
  onResend?: () => Promise<ActionResult<undefined>>;
  children: React.ReactNode;
}) {
  const [waited, setWaited] = React.useState(0);
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (!onResend) return;

    // The timer keeps running once it reaches the threshold rather than
    // clearing itself. Stopping it would mean a second send — which resets
    // the count to zero — had nothing left to tick it back up, leaving the
    // button disabled for as long as the screen is open.
    const id = window.setInterval(() => {
      setWaited((seconds) => Math.min(seconds + 1, RESEND_AFTER));
    }, 1000);

    return () => window.clearInterval(id);
  }, [onResend]);

  const left = RESEND_AFTER - waited;

  async function resend() {
    if (!onResend) return;

    setSending(true);
    try {
      const result = await onResend();
      if (result.ok) {
        toast.success("Sent again. It can take a minute to arrive.");
        setWaited(0);
      } else {
        toast.error(result.error);
      }
    } catch (thrown) {
      console.error("[auth]", thrown);
      toast.error("Could not send that. Check your connection.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-card rounded-card border p-6 text-center">
      <span className="bg-income-soft text-income rounded-card mx-auto mb-4 flex size-12 items-center justify-center">
        <MailCheck className="size-6" aria-hidden="true" />
      </span>

      <h2 className="text-base font-semibold">{title}</h2>

      {email ? (
        <p className="text-ink mt-1 text-sm font-semibold break-all">{email}</p>
      ) : null}

      <p className="text-ink-2 mt-1 text-sm">{children}</p>

      {onResend ? (
        <div className="mt-5">
          <Button
            variant="outline"
            size="touch"
            onClick={resend}
            disabled={sending || left > 0}
          >
            {sending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Sending…
              </>
            ) : (
              "Send it again"
            )}
          </Button>

          {left > 0 ? (
            // Polite: a countdown that interrupts a screen reader every
            // second would be unbearable, and nothing here needs acting on.
            <p className="text-ink-3 mt-2 text-xs" aria-live="polite">
              You can ask for another in {left} second{left === 1 ? "" : "s"}.
            </p>
          ) : null}
        </div>
      ) : null}

      {process.env.NODE_ENV === "development" ? (
        <p className="text-ink-3 mt-4 text-xs">
          Developing locally? The mail is waiting in Mailpit at{" "}
          <a
            className="underline underline-offset-2"
            href="http://127.0.0.1:54324"
            target="_blank"
            rel="noopener noreferrer"
          >
            127.0.0.1:54324
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}
