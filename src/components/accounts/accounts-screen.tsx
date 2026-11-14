"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  EllipsisVertical,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import {
  deleteAccount,
  reorderAccounts,
  setAccountArchived,
} from "@/actions/accounts";
import { AccountFormSheet } from "@/components/accounts/account-form-sheet";
import type { AccountView } from "@/components/accounts/types";
import { EmptyState } from "@/components/empty-state";
import { useFormatMoney } from "@/components/profile-provider";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { DragHandle, SortableList } from "@/components/shared/sortable-list";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  type AccountType,
} from "@/lib/schemas/accounts";
import { cn } from "@/lib/utils";

/**
 * The Accounts tab.
 *
 * Grouped by type for reading, but sort_order is one list across all of them:
 * a reorder inside a group rebuilds the whole sequence, so two accounts can
 * never end up claiming the same slot.
 */
export function AccountsScreen({ accounts }: { accounts: AccountView[] }) {
  const router = useRouter();
  const formatMoney = useFormatMoney();

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AccountView | undefined>();
  const [pendingDelete, setPendingDelete] = React.useState<AccountView | null>(
    null,
  );
  // Kept so the dialog does not flash "Delete undefined?" while it closes.
  const lastDeleteName = React.useRef("");
  const [deleting, setDeleting] = React.useState(false);
  const [showArchived, setShowArchived] = React.useState(false);

  const active = accounts.filter((account) => !account.archived);
  const archived = accounts.filter((account) => account.archived);

  const total = active
    .filter((account) => account.includeInTotal)
    .reduce((sum, account) => sum + BigInt(account.balance), 0n);

  const groups = ACCOUNT_TYPES.map((type) => ({
    type,
    accounts: active.filter((account) => account.type === type),
  })).filter((group) => group.accounts.length > 0);

  function openAdd() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(account: AccountView) {
    setEditing(account);
    setFormOpen(true);
  }

  /** Rebuilds the global order with one group replaced. */
  async function reorderGroup(type: AccountType, ids: string[]) {
    const next: string[] = [];

    for (const group of groups) {
      if (group.type === type) {
        next.push(...ids);
      } else {
        next.push(...group.accounts.map((account) => account.id));
      }
    }

    // Archived accounts keep their slots at the end.
    next.push(...archived.map((account) => account.id));

    const result = await reorderAccounts({ ids: next });

    // Thrown rather than toasted here: SortableList reports it through
    // onReorderError, so both failure paths end in one place.
    if (!result.ok) throw new Error(result.error);

    // Without this the props keep the old order, and a drag in another group
    // would then send that stale sequence and undo this one.
    router.refresh();
  }

  async function toggleArchived(account: AccountView) {
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
        account.archived ? "Account restored" : `${account.name} archived`,
      );
      router.refresh();
    } catch (thrown) {
      console.error("[accounts]", thrown);
      toast.error("Could not save that. Check your connection and try again.");
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;

    setDeleting(true);

    try {
      const result = await deleteAccount({ id: pendingDelete.id });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Account deleted");
      setPendingDelete(null);
      router.refresh();
    } catch (thrown) {
      console.error("[accounts]", thrown);
      toast.error("Could not delete that. Check your connection and try again.");
    } finally {
      // In a finally so a thrown action cannot leave the dialog spinning.
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <section
        aria-label="Total balance"
        className="bg-card rounded-2xl border p-4"
      >
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Total balance
        </p>
        <p
          className={cn(
            "amount mt-1 text-3xl font-semibold",
            total < 0n && "text-expense",
          )}
        >
          {formatMoney(total)}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          Across {active.filter((a) => a.includeInTotal).length} of{" "}
          {active.length} {active.length === 1 ? "account" : "accounts"}
        </p>
      </section>

      {active.length === 0 ? (
        <EmptyState
          art="accounts"
          icon={Wallet}
          title="No accounts yet"
          description="Add Cash, a bank account or a UPI wallet, then every record can move money between them."
          action={
            <Button size="touch" onClick={openAdd}>
              <Plus className="size-4" aria-hidden="true" />
              Add account
            </Button>
          }
        />
      ) : null}

      {groups.map((group) => (
        <section key={group.type} aria-label={ACCOUNT_TYPE_LABELS[group.type]}>
          <h2 className="text-muted-foreground mb-1.5 px-1 text-xs font-semibold tracking-wider uppercase">
            {ACCOUNT_TYPE_LABELS[group.type]}
          </h2>

          <SortableList
            items={group.accounts}
            getId={(account) => account.id}
            onReorder={(ids) => reorderGroup(group.type, ids)}
            onReorderError={(error) => {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not save the new order.",
              );
              router.refresh();
            }}
            className="bg-card divide-border divide-y overflow-hidden rounded-xl border"
            renderItem={(account, { handleProps, isDragging }) => (
              <AccountRow
                account={account}
                isDragging={isDragging}
                handleProps={handleProps}
                formatMoney={formatMoney}
                onEdit={() => openEdit(account)}
                onArchive={() => void toggleArchived(account)}
                onDelete={() => {
                  lastDeleteName.current = account.name;
                  setPendingDelete(account);
                }}
              />
            )}
          />
        </section>
      ))}

      {active.length > 0 ? (
        <Button
          variant="outline"
          size="touch"
          className="w-full"
          onClick={openAdd}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add account
        </Button>
      ) : null}

      {archived.length > 0 ? (
        <section aria-label="Archived accounts">
          <button
            type="button"
            onClick={() => setShowArchived((open) => !open)}
            aria-expanded={showArchived}
            className="text-muted-foreground hoverable:text-foreground focus-visible:ring-ring flex min-h-11 w-full items-center gap-1.5 rounded-lg px-1 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            {showArchived ? (
              <ChevronDown className="size-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-4" aria-hidden="true" />
            )}
            Archived ({archived.length})
          </button>

          {showArchived ? (
            <ul className="bg-card divide-border mt-1.5 divide-y overflow-hidden rounded-xl border opacity-80">
              {archived.map((account) => (
                <li key={account.id}>
                  <AccountRow
                    account={account}
                    formatMoney={formatMoney}
                    onEdit={() => openEdit(account)}
                    onArchive={() => void toggleArchived(account)}
                    onDelete={() => {
                      lastDeleteName.current = account.name;
                      setPendingDelete(account);
                    }}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <AccountFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        account={editing}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.name ?? lastDeleteName.current}?`}
        description="This account has no records, so nothing else will change. It cannot be undone."
        pending={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

function AccountRow({
  account,
  handleProps,
  isDragging,
  formatMoney,
  onEdit,
  onArchive,
  onDelete,
}: {
  account: AccountView;
  handleProps?: React.HTMLAttributes<HTMLElement>;
  isDragging?: boolean;
  formatMoney: (minor: bigint) => string;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const balance = BigInt(account.balance);
  const canDelete = account.usageCount === 0;

  return (
    <div
      className={cn(
        "bg-card flex items-center gap-1 pr-1 pl-1",
        isDragging && "bg-muted",
      )}
    >
      {handleProps ? <DragHandle {...handleProps} /> : <span className="w-2" />}

      <Link
        href={`/accounts/${account.id}`}
        className="hoverable:bg-muted/50 focus-visible:ring-ring flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-lg px-2 transition-colors focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
      >
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: account.color ?? "#64748B" }}
        >
          <DynamicIcon name={account.icon} className="size-[18px]" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {account.name}
          </span>
          {!account.includeInTotal || account.archived ? (
            <span className="text-muted-foreground block text-xs">
              {account.archived ? "Archived" : "Not in total"}
            </span>
          ) : null}
        </span>

        <span
          className={cn(
            "amount shrink-0 text-sm font-semibold",
            balance < 0n && "text-expense",
          )}
        >
          {formatMoney(balance)}
        </span>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-touch"
            aria-label={`Actions for ${account.name}`}
          >
            <EllipsisVertical className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil className="size-4" aria-hidden="true" />
            Edit
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={onArchive}>
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

          <DropdownMenuItem
            variant="destructive"
            disabled={!canDelete}
            onSelect={canDelete ? onDelete : undefined}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {canDelete ? "Delete" : "Delete (has records)"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
