import type { Metadata } from "next";

import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Receipt } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { AddRecordButton } from "@/components/records/add-record-button";
import { PageHeader } from "@/components/layout/page-header";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
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
    <>
      <PageHeader
        title={account.name}
        description={`${ACCOUNT_TYPE_LABELS[account.type]}${
          account.archived ? " · Archived" : ""
        }`}
        actions={
          <Link
            href="/accounts"
            aria-label="Back to accounts"
            className="hoverable:bg-muted focus-visible:ring-ring flex size-11 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Link>
        }
      />

      <section className="bg-card rounded-2xl border p-4">
        <div className="flex items-center gap-3">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: account.color ?? "#64748B" }}
          >
            <DynamicIcon name={account.icon} className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
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
          <div className="bg-income-soft rounded-xl p-3">
            <p className="text-income flex items-center gap-1 text-xs font-semibold">
              <ArrowDownLeft className="size-3.5" aria-hidden="true" />
              In this month
            </p>
            <p className="amount text-income mt-1 truncate text-base font-semibold">
              {formatWith(currency, flow.moneyIn)}
            </p>
          </div>

          <div className="bg-expense-soft rounded-xl p-3">
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

      <h2 className="text-muted-foreground mt-5 mb-1.5 px-1 text-xs font-semibold tracking-wider uppercase">
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
        <ul className="bg-card divide-border divide-y overflow-hidden rounded-xl border">
          {transactions.map((transaction) => (
            <li
              key={transaction.id}
              className="flex min-h-14 items-center gap-3 px-3 py-2"
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-white"
                style={{
                  backgroundColor: transaction.categoryColor ?? "#64748B",
                }}
              >
                <DynamicIcon
                  name={
                    transaction.type === "transfer"
                      ? "ArrowLeftRight"
                      : transaction.categoryIcon
                  }
                  className="size-[18px]"
                />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {transaction.note ??
                    transaction.categoryName ??
                    (transaction.type === "transfer" ? "Transfer" : "Record")}
                </span>
                <span className="text-muted-foreground block truncate text-xs">
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
                    : "text-foreground",
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
    </>
  );
}
