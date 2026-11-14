"use client";

import * as React from "react";

import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { changePassword } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { FormRow, PasswordInput } from "@/components/ui/form-row";

/**
 * Change password, collapsed until asked for.
 *
 * Three password boxes permanently on the Settings screen is three boxes
 * nobody fills in; behind a button they are there when wanted.
 */
export function ChangePasswordCard() {
  const [open, setOpen] = React.useState(false);
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [errorField, setErrorField] = React.useState<string | null>(null);

  function reset() {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
    setErrorField(null);
  }

  async function submit() {
    setSaving(true);
    setError(null);
    setErrorField(null);

    try {
      const result = await changePassword({
        currentPassword: current,
        newPassword: next,
        confirmPassword: confirm,
      });

      if (!result.ok) {
        setError(result.error);
        setErrorField(result.field ?? null);
        return;
      }

      toast.success("Password changed");
      reset();
      setOpen(false);
    } catch (thrown) {
      console.error("[settings]", thrown);
      const message = "Could not save. Check your connection and try again.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const fieldError = (field: string) =>
    errorField === field ? (error ?? undefined) : undefined;

  return (
    <section className="bg-card rounded-2xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Password</h2>
          <p className="text-muted-foreground text-xs">
            Change the password you sign in with.
          </p>
        </div>

        <Button
          variant="outline"
          size="touch"
          aria-expanded={open}
          onClick={() => {
            reset();
            setOpen((value) => !value);
          }}
        >
          <KeyRound className="size-4" aria-hidden="true" />
          {open ? "Cancel" : "Change"}
        </Button>
      </div>

      {open ? (
        <div className="mt-4 space-y-4 border-t pt-4">
          <FormRow
            id="current-password"
            label="Current password"
            error={fieldError("currentPassword")}
          >
            {(props) => (
              <PasswordInput
                {...props}
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
                autoComplete="current-password"
              />
            )}
          </FormRow>

          <FormRow
            id="new-password"
            label="New password"
            hint="At least 8 characters."
            error={fieldError("newPassword")}
          >
            {(props) => (
              <PasswordInput
                {...props}
                value={next}
                onChange={(event) => setNext(event.target.value)}
                autoComplete="new-password"
              />
            )}
          </FormRow>

          <FormRow
            id="confirm-password"
            label="Repeat new password"
            error={fieldError("confirmPassword")}
          >
            {(props) => (
              <PasswordInput
                {...props}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
              />
            )}
          </FormRow>

          {error && !errorField ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}

          <Button
            size="touch"
            className="w-full"
            disabled={saving || !current || !next || !confirm}
            onClick={() => void submit()}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Change password
          </Button>
        </div>
      ) : null}
    </section>
  );
}
