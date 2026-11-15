"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import {
  Archive,
  ArchiveRestore,
  EllipsisVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { deleteAccount, setAccountArchived } from "@/actions/accounts";
import { AccountFormSheet } from "@/components/accounts/account-form-sheet";
import type { AccountView } from "@/components/accounts/types";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Dialog = "archive" | "delete" | "cannot-delete";

/**
 * Edit, Archive and Delete for one account: the same menu on the list row
 * and on the account's own screen.
 *
 * There used to be two, and they disagreed. The row had Delete and the
 * detail did not; the row's Delete was a disabled item reading "Delete (has
 * records)" for most accounts; and Archive acted on a single tap from a
 * 28px item sitting directly on top of Delete. A thumb aiming for Delete on
 * a phone could archive the account with nothing to stop it.
 *
 * So, one rule each:
 *  - Archive hides, so it asks first. Restore only brings something back,
 *    so it does not.
 *  - Delete is always a live item, set apart below a divider. It confirms
 *    when the account is empty and explains when it is not, and the
 *    explanation has no Archive button in it: choosing Delete never ends in
 *    an archive.
 */
export function AccountMenu({
  account,
  onEdit,
  onDeleted,
}: {
  account: AccountView;
  onEdit: () => void;
  /** Where to go once the account no longer exists. */
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<Dialog | null>(null);
  const [working, setWorking] = React.useState(false);

  // Kept while the dialog animates closed, so its words do not change
  // under the user on the way out.
  const shown = React.useRef<Dialog>("archive");
  if (dialog) shown.current = dialog;

  async function setArchived(archived: boolean) {
    setWorking(true);
    try {
      const result = await setAccountArchived({ id: account.id, archived });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        archived ? `${account.name} archived` : `${account.name} restored`,
      );
      setDialog(null);
      router.refresh();
    } catch (thrown) {
      console.error("[accounts]", thrown);
      toast.error("Could not do that. Check your connection.");
    } finally {
      setWorking(false);
    }
  }

  async function remove() {
    setWorking(true);
    try {
      const result = await deleteAccount({ id: account.id });
      if (!result.ok) {
        // The page can be minutes old: a record added elsewhere since then
        // is caught by the server, and the answer is the same explanation
        // the menu would have given with fresh data.
        if (/still has records/i.test(result.error)) {
          setDialog("cannot-delete");
          return;
        }
        toast.error(result.error);
        return;
      }
      toast.success(`${account.name} deleted`);
      setDialog(null);
      onDeleted?.();
      router.refresh();
    } catch (thrown) {
      console.error("[accounts]", thrown);
      toast.error("Could not delete that. Check your connection.");
    } finally {
      setWorking(false);
    }
  }

  const which = dialog ?? shown.current;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-touch"
            aria-label={`Actions for ${account.name}`}
            disabled={working}
          >
            <EllipsisVertical className="size-5" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil aria-hidden="true" />
            Edit
          </DropdownMenuItem>

          {account.archived ? (
            <DropdownMenuItem onSelect={() => void setArchived(false)}>
              <ArchiveRestore aria-hidden="true" />
              Restore
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setDialog("archive")}>
              <Archive aria-hidden="true" />
              Archive
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            variant="destructive"
            onSelect={() =>
              setDialog(account.usageCount > 0 ? "cannot-delete" : "delete")
            }
          >
            <Trash2 aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {which === "archive" ? (
        <ConfirmDialog
          open={dialog === "archive"}
          onOpenChange={(open) => !open && setDialog(null)}
          title={`Archive ${account.name}?`}
          description="It leaves your lists and totals. Its records stay as they are, and you can restore it from Archived at any time."
          confirmLabel="Archive"
          tone="default"
          pending={working}
          onConfirm={() => void setArchived(true)}
        />
      ) : which === "delete" ? (
        <ConfirmDialog
          open={dialog === "delete"}
          onOpenChange={(open) => !open && setDialog(null)}
          title={`Delete ${account.name}?`}
          description="This account has no records, so nothing else changes. This cannot be undone."
          confirmLabel="Delete"
          pending={working}
          onConfirm={() => void remove()}
        />
      ) : (
        <ConfirmDialog
          open={dialog === "cannot-delete"}
          onOpenChange={(open) => !open && setDialog(null)}
          title={`${account.name} cannot be deleted`}
          description="It still has records or repeating rules. Delete or move those first. To hide the account without losing anything, use Archive."
          cancelLabel="OK"
        />
      )}
    </>
  );
}

/** The menu on an account's own screen, which owns its edit sheet. */
export function AccountActions({ account }: { account: AccountView }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);

  return (
    <>
      <AccountMenu
        account={account}
        onEdit={() => setEditing(true)}
        onDeleted={() => router.replace("/accounts")}
      />
      <AccountFormSheet
        open={editing}
        onOpenChange={setEditing}
        account={account}
      />
    </>
  );
}
