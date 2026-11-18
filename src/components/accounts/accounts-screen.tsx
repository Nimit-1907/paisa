"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  Check,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { reorderAccounts } from "@/actions/accounts";
import { AccountMenu } from "@/components/accounts/account-actions";
import { AccountFormSheet } from "@/components/accounts/account-form-sheet";
import type { AccountView } from "@/components/accounts/types";
import { Amount } from "@/components/shared/amount";
import { EmptyState } from "@/components/shared/empty-state";
import { HeroStat } from "@/components/shared/hero-stat";
import { SectionHeader } from "@/components/shared/section-header";
import { DragHandle, SortableList } from "@/components/shared/sortable-list";
import { Button } from "@/components/ui/button";
import { ACCOUNT_TYPE_LABELS } from "@/lib/schemas/accounts";
import { cn } from "@/lib/utils";
import { Tile } from "@/components/shared/tile";

/**
 * The Accounts tab.
 *
 * Grouped by type for reading, but sort_order is one list across all of them:
 * a reorder inside a group rebuilds the whole sequence, so two accounts can
 * never end up claiming the same slot.
 */
export function AccountsScreen({ accounts }: { accounts: AccountView[] }) {
  const router = useRouter();

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AccountView | undefined>();
  const [showNetWorth, setShowNetWorth] = React.useState(false);
  const [showArchived, setShowArchived] = React.useState(false);
  /*
   * Handles only while reordering, as on Categories.
   *
   * A drag handle in front of every row costs 28px of a 360px line, and
   * that was the 28px the account's name needed: "HDFC Savings" came out
   * as "HDFC S…" next to a balance that is five digits and a symbol wide.
   * Reordering is something people do once; reading the names is what the
   * screen is for.
   */
  const [reordering, setReordering] = React.useState(false);

  const active = accounts.filter((account) => !account.archived);
  const archived = accounts.filter((account) => account.archived);

  const total = active
    .filter((account) => account.includeInTotal)
    .reduce((sum, account) => sum + BigInt(account.balance), 0n);

  function openAdd() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(account: AccountView) {
    setEditing(account);
    setFormOpen(true);
  }

  /** Saves a new order for the active accounts; archived keep the end. */
  async function reorder(ids: string[]) {
    const result = await reorderAccounts({
      ids: [...ids, ...archived.map((account) => account.id)],
    });

    // Thrown rather than toasted here: SortableList reports it through
    // onReorderError, so both failure paths end in one place.
    if (!result.ok) throw new Error(result.error);

    // Without this the props keep the old order, and the next drag would
    // send that stale sequence and undo this one.
    router.refresh();
  }

  const included = active.filter((account) => account.includeInTotal).length;
  const excluded = active.length - included;
  // Balance crosses the RSC boundary as text, like every amount does.
  const netWorth = active.reduce(
    (sum, account) => sum + BigInt(account.balance),
    0n,
  );
  const shown = showNetWorth ? netWorth : total;

  return (
    <div className="space-y-4">
      {/*
        Two figures, one at a time.

        "Total balance" is the spendable money, the accounts someone ticked
        into their total. "Net worth" is every account including the ones
        they left out, which is usually a long-term savings pot they did not
        want counted against this month's spending. Showing both at once
        invites the question of which is the real one; the toggle makes it a
        choice, and the caption says which is on screen.
      */}
      <HeroStat
        label={showNetWorth ? "Net worth" : "Total balance"}
        value={
          <span className={shown < 0n ? "text-expense" : undefined}>
            <Amount value={shown} whole />
          </span>
        }
        helper={
          showNetWorth
            ? `Every account, including the ${excluded} left out of your total`
            : `Across ${included} of ${active.length} ${
                active.length === 1 ? "account" : "accounts"
              }`
        }
        trend={
          excluded > 0 ? (
            <Button
              variant="secondary"
              size="touch"
              className="px-3"
              aria-pressed={showNetWorth}
              onClick={() => setShowNetWorth((on) => !on)}
            >
              {showNetWorth ? "Spendable" : "Net worth"}
            </Button>
          ) : null
        }
      />

      {active.length === 0 ? (
        <EmptyState
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

      {/*
        One list, not one card per account type.

        Grouping by type gave four headings over four cards of one row
        each, which is more structure than four accounts have. The type
        now sits under each name, the list keeps the order you chose, and
        Reorder lives on the list's own heading instead of floating above
        it.
      */}
      {active.length > 0 ? (
        <section aria-label="Your accounts" className="space-y-2">
          <SectionHeader
            title="Your accounts"
            count={active.length}
            className="min-h-11 items-center px-1"
            trailing={
              active.length > 1 ? (
                <Button
                  variant={reordering ? "default" : "ghost"}
                  size="touch"
                  className="px-3"
                  onClick={() => setReordering((on) => !on)}
                >
                  {reordering ? (
                    <>
                      <Check className="size-4" aria-hidden="true" />
                      Done
                    </>
                  ) : (
                    <>
                      <GripVertical className="size-4" aria-hidden="true" />
                      Reorder
                    </>
                  )}
                </Button>
              ) : null
            }
          />

          <div className="bg-surface rounded-card overflow-hidden border">
            <SortableList
              items={active}
              getId={(account) => account.id}
              onReorder={(ids) => reorder(ids)}
              onReorderError={(error) => {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Could not save the new order.",
                );
                router.refresh();
              }}
              className="divide-hairline divide-y"
              disabled={!reordering}
              renderItem={(account, { handleProps, isDragging }) => (
                <AccountRow
                  account={account}
                  isDragging={isDragging}
                  handleProps={reordering ? handleProps : undefined}
                  onEdit={() => openEdit(account)}
                />
              )}
            />

            {/* The list's own last row, so adding sits where the accounts
                are rather than as a separate slab under them. */}
            <button
              type="button"
              onClick={openAdd}
              className="text-text hoverable:bg-surface-muted border-hairline flex min-h-12 w-full items-center gap-3 border-t px-4 text-sm font-semibold"
            >
              <span className="bg-surface-muted rounded-control flex size-9 items-center justify-center">
                <Plus className="size-4" aria-hidden="true" />
              </span>
              Add account
            </button>
          </div>
        </section>
      ) : null}

      {archived.length > 0 ? (
        <section aria-label="Archived accounts">
          <button
            type="button"
            onClick={() => setShowArchived((open) => !open)}
            aria-expanded={showArchived}
            className="text-text-secondary hoverable:text-text rounded-control flex min-h-11 w-full items-center gap-1.5 px-1 text-sm font-semibold"
          >
            {showArchived ? (
              <ChevronDown className="size-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-4" aria-hidden="true" />
            )}
            Archived ({archived.length})
          </button>

          {showArchived ? (
            <ul className="bg-surface divide-hairline rounded-card mt-1.5 divide-y overflow-hidden border">
              {archived.map((account) => (
                <li key={account.id}>
                  <AccountRow
                    account={account}
                    onEdit={() => openEdit(account)}
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
    </div>
  );
}

function AccountRow({
  account,
  handleProps,
  isDragging,
  onEdit,
}: {
  account: AccountView;
  handleProps?: React.HTMLAttributes<HTMLElement>;
  isDragging?: boolean;
  onEdit: () => void;
}) {
  const balance = BigInt(account.balance);

  // The type, and anything unusual about the account, on one quiet line.
  // The type is left out when the name already says it: an account called
  // "Cash" of type Cash would otherwise read "Cash" twice.
  const typeLabel = ACCOUNT_TYPE_LABELS[account.type];
  const subtitle = [
    typeLabel.toLowerCase() === account.name.trim().toLowerCase()
      ? null
      : typeLabel,
    account.archived ? "Archived" : null,
    !account.archived && !account.includeInTotal ? "Not in total" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={cn(
        "bg-surface flex items-center pr-1",
        isDragging && "bg-surface-muted",
        account.archived && "text-text-secondary",
      )}
    >
      {handleProps ? <DragHandle {...handleProps} /> : null}

      <Link
        href={`/accounts/${account.id}`}
        className={cn(
          "hoverable:bg-surface-muted flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2 transition-colors",
          handleProps ? "pl-1" : "pl-4",
        )}
      >
        <Tile tint={account.tint} icon={account.icon} size="md" />

        <span className="min-w-0 flex-1">
          {/* Wraps to a second line rather than cut "ICICI Credit C…" with
              room to spare: the name is what the row is for. */}
          <span className="text-text line-clamp-2 text-sm font-semibold break-words">
            {account.name}
          </span>
          {subtitle ? (
            <span className="text-text-secondary block truncate text-xs">
              {subtitle}
            </span>
          ) : null}
        </span>

        <span
          className={cn(
            "amount shrink-0 pl-2 text-sm font-semibold",
            balance < 0n ? "text-expense" : "text-text",
          )}
        >
          <Amount value={balance} />
        </span>
      </Link>

      <AccountMenu account={account} onEdit={onEdit} />
    </div>
  );
}
