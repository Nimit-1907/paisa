"use client";

import * as React from "react";

import { Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { useRouter } from "next/navigation";

import { deleteAccount } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { DELETE_CONFIRMATION } from "@/lib/schemas/profile";

/**
 * Deleting the account, and everything in it.
 *
 * There is no undo and no export-first step forced on anyone, so the guard is
 * typing the word: a button alone is too easy to hit by accident, and a
 * checkbox is something people tick without reading.
 */
export function DeleteAccountCard({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState("");
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (open) setConfirm("");
  }, [open]);

  async function run() {
    setPending(true);

    try {
      const result = await deleteAccount({ confirm });

      if (!result.ok) {
        toast.error(result.error);
        setOpen(false);
        return;
      }

      // The account is gone and so is the session, so there is nothing left
      // on this page to go back to.
      router.replace(result.data.next);
      router.refresh();
    } catch (thrown) {
      console.error("[settings]", thrown);
      toast.error("Could not delete your account. Check your connection.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="border-destructive/30 bg-destructive/5 rounded-card border p-4">
      <h2 className="text-destructive flex items-center gap-1.5 text-sm font-semibold">
        <TriangleAlert className="size-4" aria-hidden="true" />
        Delete account
      </h2>
      <p className="text-ink-2 mt-1 text-xs">
        Removes {email} and every record, account, budget and recurring rule
        that belongs to it. This cannot be undone — export your records first
        if you want to keep them.
      </p>

      <Button
        variant="outline"
        size="touch"
        className="text-destructive hoverable:text-destructive mt-3 w-full"
        onClick={() => setOpen(true)}
      >
        Delete my account
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete everything?</DialogTitle>
            <DialogDescription>
              This removes your account and all of its data straight away.
              There is no undo.
            </DialogDescription>
          </DialogHeader>

          <FormRow
            id="delete-confirm"
            label={`Type ${DELETE_CONFIRMATION} to confirm`}
          >
            {(props) => (
              <Input
                {...props}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                placeholder={DELETE_CONFIRMATION}
              />
            )}
          </FormRow>

          <DialogFooter className="flex-row gap-2">
            <Button
              variant="outline"
              size="touch"
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="touch"
              className="flex-1"
              disabled={pending || confirm.trim() !== DELETE_CONFIRMATION}
              onClick={() => void run()}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
