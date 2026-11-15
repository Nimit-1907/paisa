import type { Metadata } from "next";

import { notFound } from "next/navigation";

import { ArrowDownLeft, ArrowUpRight, Receipt } from "lucide-react";

import { AccountActions } from "@/components/accounts/account-actions";
import { Amount } from "@/components/shared/amount";
import type { AccountView } from "@/components/accounts/types";
import { EmptyState } from "@/components/shared/empty-state";
import { HeroSplit, HeroStat } from "@/components/shared/hero-stat";
import { SectionHeader } from "@/components/shared/section-header";
import { ListCard } from "@/components/shared/surface";
import { AddRecordButton } from "@/components/records/add-record-button";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { currentMonthRange } from "@/lib/dates";
import { getProfile } from "@/lib/profile";
import {
  getAccount,
  getAccountBalance,
  getAccountMonthFlow,
  getAccountTransactions,
  isUuid,
} from "@/lib/queries/accounts";
import { ACCOUNT_TYPE_LABELS } from "@/lib/schemas/accounts";
import { cn } from "@/lib/utils";
import { Tile } from "@/components/shared/tile";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Account" };

  const account = await getAccount(id);
  return { title: account?.name ?? "Account" };
}

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // A malformed id is a 404, not a 500: the path is user-typed, and nothing
  // good comes of letting it reach a query.
  if (!isUuid(id)) notFound();

  const [account, profile] = await Promise.all([getAccount(id), getProfile()]);

  // RLS makes another user's account indistinguishable from one that does not
  // exist, which is exactly what we want to tell the browser.
  if (!account) notFound();

  const range = currentMonthRange(profile?.timezone ?? "Asia/Kolkata");

  const [balance, flow, transactions] = await Promise.all([
    getAccountBalance(id),
    getAccountMonthFlow(id, range.monthStart),
    getAccountTransactions(id),
  ]);

  // The island below is a client component, so the account crosses the
  // boundary as the same `AccountView` every other screen uses — amounts as
  // minor-unit strings, because an RSC payload has no BigInt.
  const view: AccountView = {
    id: account.id,
    name: account.name,
    type: account.type,
    icon: account.icon,
    color: account.color,
    tint: account.tint,
    initialBalance: account.initial_balance.toString(),
    balance: balance.toString(),
    includeInTotal: account.include_in_total,
    archived: account.archived,
    usageCount: 0,
  };

  const dateFormatter = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: profile?.timezone ?? "Asia/Kolkata",
  });

  return (
    <PageShell>
      <PageHeader
        title={account.name}
        back={{ href: "/accounts", label: "Back to accounts" }}
        description={`${ACCOUNT_TYPE_LABELS[account.type]}${
          account.archived ? " · Archived" : ""
        }`}
        actions={<AccountActions account={view} />}
      />

      <HeroStat
        label={
          <span className="flex min-w-0 items-center gap-2">
            <Tile tint={account.tint} icon={account.icon} size="sm" />
            <span className="truncate">Balance</span>
          </span>
        }
        value={
          <span className={balance < 0n ? "text-expense" : undefined}>
            <Amount value={balance} />
          </span>
        }
        split={
          <>
            <HeroSplit
              label="In this month"
              tint="bg-tint-mint"
              icon={<ArrowDownLeft className="size-3.5" />}
              value={
                <span className="text-income">
                  <Amount value={flow.moneyIn} whole />
                </span>
              }
            />
            <HeroSplit
              label="Out this month"
              tint="bg-tint-rose"
              icon={<ArrowUpRight className="size-3.5" />}
              value={
                <span className="text-expense">
                  <Amount value={flow.moneyOut} whole />
                </span>
              }
            />
          </>
        }
      />

      <SectionHeader className="mt-5 mb-1.5 px-1" title="Records" />

      {transactions.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nothing here yet"
          description="Records booked against this account will show up here."
          action={<AddRecordButton />}
        />
      ) : (
        <ListCard>
          {transactions.map((transaction) => (
            <li
              key={transaction.id}
              className="flex min-h-14 items-center gap-3 px-3 py-2"
            >
              <Tile
                tint={
                  transaction.type === "transfer"
                    ? "sky"
                    : transaction.categoryTint
                }
                icon={
                  transaction.type === "transfer"
                    ? "ArrowLeftRight"
                    : transaction.categoryIcon
                }
              />

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {transaction.note ??
                    transaction.categoryName ??
                    (transaction.type === "transfer" ? "Transfer" : "Record")}
                </span>
                <span className="text-text-secondary block truncate text-xs">
                  {dateFormatter.format(new Date(transaction.occurredAt))}
                  {transaction.counterparty
                    ? ` · ${transaction.signedAmount > 0n ? "from" : "to"} ${transaction.counterparty}`
                    : transaction.categoryName
                      ? ` · ${transaction.categoryName}`
                      : ""}
                </span>
              </span>

              <span
                className={cn(
                  "amount shrink-0 text-sm font-semibold",
                  transaction.signedAmount > 0n ? "text-income" : "text-text",
                )}
              >
                <Amount value={transaction.signedAmount} signDisplay="always" />
              </span>
            </li>
          ))}
        </ListCard>
      )}
    </PageShell>
  );
}
