import type { Metadata } from "next";

import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeft, CalendarClock, History, Repeat } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { RuleActions } from "@/components/recurring/rule-actions";
import { RuleAvatar } from "@/components/recurring/rule-avatar";
import { formatWith } from "@/lib/money";
import { DEFAULT_TIME_ZONE } from "@/lib/month-param";
import { currencyOf, getProfile } from "@/lib/profile";
import { toAccountOptions, toCategoryOptions } from "@/lib/entry-options";
import { getActiveAccounts } from "@/lib/queries/accounts";
import { getActiveCategories } from "@/lib/queries/categories";
import {
  getRecurringRule,
  getRuleTransactions,
  isUuid,
} from "@/lib/queries/recurring";
import { describeSchedule } from "@/lib/recurrence";
import { localToday } from "@/lib/recurring-check";
import { ruleTitle, scheduleOf, upcomingFor } from "@/lib/recurring-rule";
import { dayLabel, daysAway } from "@/lib/relative-day";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Recurring" };

  const rule = await getRecurringRule(id);
  return { title: rule ? ruleTitle(rule) : "Recurring" };
}

export default async function RecurringRulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // A malformed id is a 404, not a 500: the path is user-typed.
  if (!isUuid(id)) notFound();

  const [rule, profile] = await Promise.all([getRecurringRule(id), getProfile()]);

  // RLS makes another user's rule indistinguishable from one that is gone,
  // which is exactly what the browser should be told.
  if (!rule) notFound();

  const currency = currencyOf(profile);
  const timeZone = profile?.timezone ?? DEFAULT_TIME_ZONE;
  const today = localToday(timeZone);

  // The most recent page of a history that can run to hundreds of rows for a
  // daily rule; the total is on the rule itself.
  const HISTORY_SHOWN = 12;

  const [history, accounts, categories] = await Promise.all([
    getRuleTransactions(rule.id, HISTORY_SHOWN),
    getActiveAccounts(),
    getActiveCategories(),
  ]);

  const next = upcomingFor(rule, 5);
  const title = ruleTitle(rule);

  const recordDate = new Intl.DateTimeFormat("en-IN", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <PageShell>
      <PageHeader
        title={title}
        description={`${describeSchedule(scheduleOf(rule))}${
          rule.active ? "" : " · Paused"
        }`}
        actions={
          <Link
            href="/recurring"
            aria-label="Back to recurring"
            className="hoverable:bg-muted focus-visible:ring-ring flex size-11 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Link>
        }
      />

      <section className="bg-card rounded-2xl border p-4">
        <div className="flex items-center gap-3">
          <RuleAvatar rule={rule} size="lg" dimmed={!rule.active} />

          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {rule.type === "income"
                ? "Income"
                : rule.type === "transfer"
                  ? "Transfer"
                  : "Expense"}
            </p>
            <p
              className={cn(
                "amount text-2xl font-semibold",
                rule.type === "income" && "text-income",
                rule.type === "transfer" && "text-transfer",
              )}
            >
              {formatWith(currency, BigInt(rule.amount), {
                signDisplay: "never",
              })}
            </p>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <Fact label="Next due">
            {rule.active
              ? rule.dueOn
                ? `${dayLabel(rule.dueOn)} · ${daysAway(rule.dueOn, today)}`
                : "Nothing left"
              : "Paused"}
          </Fact>
          <Fact label={rule.type === "transfer" ? "From" : "Account"}>
            {rule.accountName}
          </Fact>
          {rule.type === "transfer" ? (
            <Fact label="To">{rule.toAccountName ?? "—"}</Fact>
          ) : (
            <Fact label="Category">{rule.categoryName ?? "—"}</Fact>
          )}
          <Fact label="Last created">
            {rule.lastRunOn ? dayLabel(rule.lastRunOn) : "Never"}
          </Fact>
          <Fact label="Ends">
            {rule.endDate ? dayLabel(rule.endDate) : "No end date"}
          </Fact>
          {rule.skippedDates.length > 0 ? (
            <Fact label="Skipped">
              {rule.skippedDates.length}{" "}
              {rule.skippedDates.length === 1 ? "date" : "dates"}
            </Fact>
          ) : null}
        </dl>

        <RuleActions
          rule={rule}
          accounts={toAccountOptions(accounts)}
          categories={toCategoryOptions(categories)}
          today={today}
        />
      </section>

      <h2 className="text-muted-foreground mt-5 mb-1.5 flex items-center gap-1.5 px-1 text-xs font-semibold tracking-wider uppercase">
        <CalendarClock className="size-3.5" aria-hidden="true" />
        Coming up
      </h2>

      {next.length === 0 ? (
        <p className="text-muted-foreground bg-card rounded-xl border border-dashed px-4 py-6 text-center text-sm">
          {rule.active
            ? "This rule has run its course."
            : "Paused — nothing is scheduled."}
        </p>
      ) : (
        <ol className="bg-card divide-border divide-y overflow-hidden rounded-xl border">
          {next.map((on) => (
            <li
              key={on}
              className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <span className="font-semibold">{dayLabel(on)}</span>
              <span className="text-muted-foreground text-xs">
                {daysAway(on, today)}
              </span>
            </li>
          ))}
        </ol>
      )}

      <h2 className="text-muted-foreground mt-5 mb-1.5 flex items-center gap-1.5 px-1 text-xs font-semibold tracking-wider uppercase">
        <History className="size-3.5" aria-hidden="true" />
        Created so far
        {rule.recordCount > HISTORY_SHOWN ? (
          <span className="normal-case">
            · last {HISTORY_SHOWN} of {rule.recordCount}
          </span>
        ) : null}
      </h2>

      {history.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="Nothing created yet"
          description="Records this rule creates will be listed here, newest first."
        />
      ) : (
        <ul className="bg-card divide-border divide-y overflow-hidden rounded-xl border">
          {history.map((record) => (
            <li
              key={record.id}
              className="flex min-h-14 items-center justify-between gap-3 px-3 py-2"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold">
                  {recordDate.format(new Date(record.occurredAt))}
                </span>
                {record.note ? (
                  <span className="text-muted-foreground block truncate text-xs">
                    {record.note}
                  </span>
                ) : null}
              </span>

              <span
                className={cn(
                  "amount shrink-0 text-sm font-semibold",
                  rule.type === "income" && "text-income",
                )}
              >
                {formatWith(currency, BigInt(record.amount), {
                  signDisplay: "never",
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="truncate font-semibold">{children}</dd>
    </div>
  );
}
