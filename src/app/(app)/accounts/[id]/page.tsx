import type { Metadata } from "next";

import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Receipt } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { AddRecordButton } from "@/components/records/add-record-button";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { currentMonthRange } from "@/lib/dates";
import { formatWith } from "@/lib/money";
import { currencyOf, getProfile } from "@/lib/profile";
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

  const currency = currencyOf(profile);
  const range = currentMonthRange(profile?.timezone ?? "Asia/Kolkata");

  const [balance, flow, transactions] = await Promise.all([
    getAccountBalance(id),
    getAccountMonthFlow(id, range.monthStart),
    getAccountTransactions(id),
  ]);

  const dateFormatter = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: profile?.timezone ?? "Asia/Kolkata",
  });

  return (
    <PageShell>
      <PageHeader
        title={account.name}
        description={`${ACCOUNT_TYPE_LABELS[account.type]}${
          account.archived ? " · Archived" : ""
        }`}
        actions={
          <Link
            href="/accounts"
            aria-label="Back to accounts"
            className="hoverable:bg-surface-muted flex size-11 items-center justify-center rounded-full  "
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Link>
        }
      />

      <section className="bg-surface rounded-card border p-4">
        <div className="flex items-center gap-3">
          <Tile tint={account.tint} icon={account.icon} size="lg" />
          <div className="min-w-0">
            <p className="text-text-secondary text-xs font-semibold ">
              Balance
            </p>
            <p
              className={cn(
                "amount text-2xl font-semibold",
                balance < 0n && "text-expense",
              )}
            >
              {formatWith(currency, balance)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="bg-tint-mint rounded-control p-3">
            <p className="text-income flex items-center gap-1 text-xs font-semibold">
              <ArrowDownLeft className="size-3.5" aria-hidden="true" />
              In this month
            </p>
            <p className="amount text-income mt-1 truncate text-base font-semibold">
              {formatWith(currency, flow.moneyIn)}
            </p>
          </div>

          <div className="bg-tint-rose rounded-control p-3">
            <p className="text-expense flex items-center gap-1 text-xs font-semibold">
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
              Out this month
            </p>
            <p className="amount text-expense mt-1 truncate text-base font-semibold">
              {formatWith(currency, flow.moneyOut)}
            </p>
          </div>
        </div>
      </section>

      <h2 className="text-text-secondary mt-5 mb-1.5 px-1 text-xs font-semibold ">
        Records
      </h2>

      {transactions.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nothing here yet"
          description="Records booked against this account will show up here."
          action={<AddRecordButton />}
        />
      ) : (
        <ul className="bg-surface divide-hairline divide-y overflow-hidden rounded-card border">
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
                  transaction.signedAmount > 0n
                    ? "text-income"
                    : "text-text",
                )}
              >
                {formatWith(currency, transaction.signedAmount, {
                  signDisplay: "always",
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
