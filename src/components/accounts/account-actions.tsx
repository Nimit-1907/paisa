"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import {
  Archive,
  ArchiveRestore,
  EllipsisVertical,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

import { setAccountArchived } from "@/actions/accounts";
import { AccountFormSheet } from "@/components/accounts/account-form-sheet";
import type { AccountView } from "@/components/accounts/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Edit and Archive, on the account's own screen.
 *
 * The list has these on every row, but the detail is where somebody lands
 * from a record or a bookmark — and a screen that can show you an account
 * and not let you change it sends you back to find the row you came from.
 *
 * Delete is deliberately not here. It is only ever offered for an account
 * nothing points at, and that check belongs with the list that already
 * knows the usage count.
 */
export function AccountActions({ account }: { account: AccountView }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function toggleArchived() {
    setPending(true);

    try {
      const result = await setAccountArchived({
        id: account.id,
        archived: !account.archived,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        account.archived
          ? `${account.name} is back`
          : `${account.name} archived`,
      );
      router.refresh();
    } catch (thrown) {
      console.error("[accounts]", thrown);
      toast.error("Could not do that. Check your connection.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-touch"
            aria-label={`Actions for ${account.name}`}
            disabled={pending}
          >
            <EllipsisVertical className="size-5" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            className="min-h-11 gap-2 px-2"
            onSelect={() => setEditing(true)}
          >
            <Pencil className="size-4" aria-hidden="true" />
            Edit account
          </DropdownMenuItem>

          <DropdownMenuItem
            className="min-h-11 gap-2 px-2"
            onSelect={() => void toggleArchived()}
          >
            {account.archived ? (
              <>
                <ArchiveRestore className="size-4" aria-hidden="true" />
                Restore
              </>
            ) : (
              <>
                <Archive className="size-4" aria-hidden="true" />
                Archive
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AccountFormSheet
        open={editing}
        onOpenChange={setEditing}
        account={account}
      />
    </>
  );
}
