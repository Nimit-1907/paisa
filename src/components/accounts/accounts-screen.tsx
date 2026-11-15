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
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  type AccountType,
} from "@/lib/schemas/accounts";
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

        "Total balance" is the spendable money — the accounts someone ticked
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

      {active.length > 1 ? (
        <div className="flex justify-end">
          <Button
            variant={reordering ? "default" : "ghost"}
            size="touch"
            className="-my-1 px-3"
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
        </div>
      ) : null}

      {groups.map((group) => (
        <section key={group.type} aria-label={ACCOUNT_TYPE_LABELS[group.type]}>
          <SectionHeader
            className="mb-1.5 px-1"
            title={ACCOUNT_TYPE_LABELS[group.type]}
          />

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
            className="bg-surface divide-hairline divide-y overflow-hidden rounded-card border"
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
            className="text-text-secondary hoverable:text-text flex min-h-11 w-full items-center gap-1.5 rounded-lg px-1 text-sm font-semibold  "
          >
            {showArchived ? (
              <ChevronDown className="size-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-4" aria-hidden="true" />
            )}
            Archived ({archived.length})
          </button>

          {showArchived ? (
            <ul className="bg-surface divide-hairline mt-1.5 divide-y overflow-hidden rounded-card border opacity-80">
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

  return (
    <div
      className={cn(
        "bg-surface flex items-center gap-1 pr-1 pl-1",
        isDragging && "bg-surface-muted",
      )}
    >
      {handleProps ? <DragHandle {...handleProps} /> : <span className="w-1" />}

      <Link
        href={`/accounts/${account.id}`}
        className="hoverable:bg-surface-muted rounded-control flex min-h-14 min-w-0 flex-1 items-center gap-3 px-2 transition-colors"
      >
        <Tile tint={account.tint} icon={account.icon} size="lg" />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {account.name}
          </span>
          {/* Only what the group heading above does not already say. The
              row sits under "Bank"; repeating "Bank" on it is a word that
              costs a line and says nothing. */}
          {account.archived || !account.includeInTotal ? (
            <span className="text-text-secondary block truncate text-xs">
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
          <Amount value={balance} />
        </span>
      </Link>

      <AccountMenu account={account} onEdit={onEdit} />
    </div>
  );
}
