import type { Metadata } from "next";

import { notFound } from "next/navigation";

import { Repeat } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { RuleActions } from "@/components/recurring/rule-actions";
import { RuleAvatar } from "@/components/recurring/rule-avatar";
import { Amount } from "@/components/shared/amount";
import { HeroStat } from "@/components/shared/hero-stat";
import { Pill } from "@/components/shared/pill";
import { SectionHeader } from "@/components/shared/section-header";
import { ListCard } from "@/components/shared/surface";
import { DEFAULT_TIME_ZONE } from "@/lib/month-param";
import { getProfile } from "@/lib/profile";
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

  const [rule, profile] = await Promise.all([
    getRecurringRule(id),
    getProfile(),
  ]);

  // RLS makes another user's rule indistinguishable from one that is gone,
  // which is exactly what the browser should be told.
  if (!rule) notFound();

  const timeZone = profile?.timezone ?? DEFAULT_TIME_ZONE;
  const today = localToday(timeZone);

  // The most recent page of a history that can run to hundreds of rows for a
  // daily rule; the total is on the rule itself.
  const HISTORY_SHOWN = 12;

  const [history, accounts, categories] = await Promise.all([
    getRuleTransactions(rule.id, HISTORY_SHOWN),
    getActiveAccounts().then((result) => result.rows),
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
        back={{ href: "/recurring", label: "Back to recurring" }}
      />

      <HeroStat
        label={
          <span className="flex min-w-0 items-center gap-2">
            <RuleAvatar rule={rule} dimmed={!rule.active} />
            <span className="text-text truncate font-semibold">
              {describeSchedule(scheduleOf(rule))}
            </span>
          </span>
        }
        trend={rule.active ? null : <Pill tone="quiet">Paused</Pill>}
        value={
          <span
            className={cn(
              rule.type === "income" && "text-income",
              rule.type === "transfer" && "text-transfer",
            )}
          >
            <Amount value={BigInt(rule.amount)} signDisplay="never" />
          </span>
        }
        helper={
          rule.active
            ? rule.dueOn
              ? `Next on ${dayLabel(rule.dueOn)} · ${daysAway(rule.dueOn, today)}`
              : "Nothing left to run"
            : "Paused. Nothing is scheduled"
        }
      />

      <section className="bg-surface rounded-card border p-4">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <Fact label={rule.type === "transfer" ? "From" : "Account"}>
            {rule.accountName}
          </Fact>
          {rule.type === "transfer" ? (
            <Fact label="To">{rule.toAccountName ?? "None"}</Fact>
          ) : (
            <Fact label="Category">{rule.categoryName ?? "None"}</Fact>
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

      <SectionHeader className="mt-5 mb-1.5 px-1" title="Coming up" />

      {next.length === 0 ? (
        <p className="text-text-secondary bg-surface rounded-card border border-dashed px-4 py-6 text-center text-sm">
          {rule.active
            ? "This rule has run its course."
            : "Paused. Nothing is scheduled."}
        </p>
      ) : (
        /*
          A timeline, not a list of rows.
 
          Five dates in a bordered card read as five separate facts; on a
          line they read as one thing continuing, which is what a recurring
          rule is. The next one takes the periwinkle dot — the same accent
          the dock's Add button and a just-saved row use for "the thing
          about to happen" — and the rest are hairline rings.
        */
        <ol className="bg-surface rounded-card border p-4 pl-5">
          {next.map((on, index) => (
            <li key={on} className="relative flex gap-3 pb-4 last:pb-0">
              {index < next.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="bg-hairline absolute top-3 bottom-0 left-[5px] w-px"
                />
              ) : null}

              <span
                aria-hidden="true"
                className={cn(
                  "relative mt-1.5 size-[11px] shrink-0 rounded-full border-[1.5px]",
                  index === 0
                    ? "bg-accent border-ink"
                    : "bg-surface border-hairline",
                )}
              />

              <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                <span className="text-sm font-semibold">{dayLabel(on)}</span>
                <span className="text-text-secondary text-xs">
                  {daysAway(on, today)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}

      <SectionHeader
        className="mt-5 mb-1.5 px-1"
        title="Created so far"
        count={rule.recordCount}
        description={
          rule.recordCount > HISTORY_SHOWN
            ? `The last ${HISTORY_SHOWN}`
            : undefined
        }
      />

      {history.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="Nothing created yet"
          description="Records this rule creates will be listed here, newest first."
        />
      ) : (
        <ListCard>
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
                  <span className="text-text-secondary block truncate text-xs">
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
                <Amount value={BigInt(record.amount)} signDisplay="never" />
              </span>
            </li>
          ))}
        </ListCard>
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
      <dt className="text-text-secondary text-xs">{label}</dt>
      <dd className="truncate font-semibold">{children}</dd>
    </div>
  );
}
