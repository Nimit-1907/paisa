"use client";

import * as React from "react";

import Link from "next/link";

import {
  EllipsisVertical,
  type LucideIcon,
  Pause,
  Pencil,
  Play,
  Repeat,
  SkipForward,
  Trash2,
} from "lucide-react";
import { Amount } from "@/components/shared/amount";
import { EmptyState } from "@/components/shared/empty-state";
import { HeroStat } from "@/components/shared/hero-stat";
import { SectionHeader } from "@/components/shared/section-header";
import { AddRecordButton } from "@/components/records/add-record-button";
import { DeleteRuleDialog } from "@/components/recurring/delete-rule-dialog";
import { DateTile } from "@/components/shared/date-tile";
import { ListCard } from "@/components/shared/surface";
import { RuleSheet } from "@/components/recurring/rule-sheet";
import { useRuleActions } from "@/components/recurring/use-rule-actions";
import type {
  AccountOption,
  CategoryOption,
} from "@/components/shared/entry-pickers";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { describeSchedule } from "@/lib/recurrence";
import {
  type RecurringRule,
  ruleTitle,
  scheduleOf,
} from "@/lib/recurring-rule";
import { dayDifference } from "@/lib/recurrence";
import { cn } from "@/lib/utils";

/**
 * The Recurring screen.
 *
 * Active rules first, because those are the ones that will take money; paused
 * ones are kept rather than deleted, since "stop charging me for a while" is
 * much more common than "I never want this again".
 */
export function RecurringScreen({
  rules,
  accounts,
  categories,
  today,
}: {
  rules: RecurringRule[];
  accounts: AccountOption[];
  categories: CategoryOption[];
  /** `yyyy-mm-dd` where the user is, for "Today"/"Tomorrow" wording. */
  today: string;
}) {
  const { pending, pause, resume, skip, remove } = useRuleActions();
  const [editing, setEditing] = React.useState<RecurringRule | null>(null);
  // Kept while the dialog animates shut, so its text does not flicker back to
  // placeholders on the way out.
  const [deleting, setDeleting] = React.useState<RecurringRule | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const active = rules.filter((rule) => rule.active);
  const paused = rules.filter((rule) => !rule.active);

  if (rules.length === 0) {
    return (
      <EmptyState
        art="recurring"
        icon={Repeat}
        title="No recurring records"
        description="Rent, salary, a subscription: add the record once with Repeat set, and it will show up here creating itself every month."
        action={<AddRecordButton label="Add a repeating record" />}
      />
    );
  }

  /*
   * Due soon is the next seven days, and it comes *out* of Active rather
   * than being repeated in it. A rule in two lists is a rule somebody pauses
   * twice and is surprised the second time.
   */
  const dueSoon = active.filter(
    (rule) => rule.dueOn && dayDifference(today, rule.dueOn) <= 7,
  );
  const dueSoonIds = new Set(dueSoon.map((rule) => rule.id));
  const later = active.filter((rule) => !dueSoonIds.has(rule.id));

  /*
   * What the active rules add up to over this month.
   *
   * Expenses only — mixing a salary into "scheduled" would produce a figure
   * that is neither what goes out nor what is left, and the question people
   * are asking is the first one. Weekly rules count four times, which is the
   * number of times they will actually be paid in most months.
   */
  const scheduledThisMonth = active.reduce((sum, rule) => {
    if (rule.type !== "expense") return sum;
    const times = rule.frequency === "weekly" ? 4n : 1n;
    return sum + BigInt(rule.amount) * times;
  }, 0n);

  return (
    <div className="space-y-6">
      {/*
        What this month costs you without deciding anything.

        Rent, a phone bill and three subscriptions are a number people
        cannot hold in their head, and it is the number that decides whether
        a month is comfortable. It leads the screen for the same reason the
        month card leads Records.
      */}
      <HeroStat
        label="Scheduled this month"
        value={<Amount value={scheduledThisMonth} signDisplay="never" whole />}
        helper={
          dueSoon.length > 0
            ? `${dueSoon.length} due in the next 7 days`
            : "Nothing due in the next 7 days"
        }
      />

      {dueSoon.length > 0 ? (
        <Section title="Due soon" count={dueSoon.length}>
          {dueSoon.map((rule) => (
            <RuleItem
              key={rule.id}
              rule={rule}
              pending={pending}
              onEdit={() => setEditing(rule)}
              onDelete={() => {
                setDeleting(rule);
                setDeleteOpen(true);
              }}
              onPause={() => void pause(rule)}
              onSkip={rule.dueOn ? () => void skip(rule) : undefined}
            />
          ))}
        </Section>
      ) : null}

      <Section
        title="Active"
        count={later.length}
        empty="Nothing is scheduled right now."
      >
        {later.map((rule) => (
          <RuleItem
            key={rule.id}
            rule={rule}
            pending={pending}
            onEdit={() => setEditing(rule)}
            onDelete={() => {
              setDeleting(rule);
              setDeleteOpen(true);
            }}
            onPause={() => void pause(rule)}
            onSkip={rule.dueOn ? () => void skip(rule) : undefined}
          />
        ))}
      </Section>

      {paused.length > 0 ? (
        <Section title="Paused" count={paused.length}>
          {paused.map((rule) => (
            <RuleItem
              key={rule.id}
              rule={rule}
              pending={pending}
              onEdit={() => setEditing(rule)}
              onDelete={() => {
                setDeleting(rule);
                setDeleteOpen(true);
              }}
              onResume={() => void resume(rule)}
            />
          ))}
        </Section>
      ) : null}

      <RuleSheet
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        rule={editing}
        accounts={accounts}
        categories={categories}
        today={today}
      />

      <DeleteRuleDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        name={deleting ? ruleTitle(deleting) : "this rule"}
        recordCount={deleting?.recordCount ?? 0}
        pending={pending}
        onConfirm={(deleteTransactions) => {
          const rule = deleting;
          if (!rule) return;

          setDeleteOpen(false);
          void remove(rule, deleteTransactions);
        }}
      />
    </div>
  );
}

function Section({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <SectionHeader className="mb-1.5 px-1" title={title} count={count} />

      {count === 0 ? (
        empty ? (
          <p className="text-text-secondary bg-surface rounded-card border border-dashed px-4 py-6 text-center text-sm">
            {empty}
          </p>
        ) : null
      ) : (
        <ListCard>{children}</ListCard>
      )}
    </section>
  );
}

function RuleItem({
  rule,
  pending,
  onEdit,
  onDelete,
  onPause,
  onResume,
  onSkip,
}: {
  rule: RecurringRule;
  pending: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onSkip?: () => void;
}) {
  const title = ruleTitle(rule);

  return (
    <li className="flex items-stretch">
      <Link
        href={`/recurring/${rule.id}`}
        className="hoverable:bg-surface-muted flex min-h-16 min-w-0 flex-1 items-center gap-2.5 py-2 pl-3 transition-colors   "
      >
        <DateTile day={rule.dueOn} dimmed={!rule.active} />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{title}</span>
          <span className="text-text-secondary block truncate text-xs">
            {describeSchedule(scheduleOf(rule))} · {rule.accountName}
          </span>
          {/* Only when the tile cannot say it. The date tile carries the
              next occurrence, so "Next on Thu, 3 Dec" beside a tile reading
              "3 DEC" is the same fact twice; what it cannot show is a rule
              that has stopped. */}
          {rule.active && rule.dueOn ? null : (
            <span className="text-text-secondary block truncate text-xs">
              {rule.active ? "Finished" : "Paused"}
            </span>
          )}
        </span>

        <span
          className={cn(
            "amount shrink-0 text-right text-sm font-semibold",
            rule.type === "income" && "text-income",
            rule.type === "transfer" && "text-transfer",
            !rule.active && "text-text-secondary",
          )}
        >
          {rule.type === "income" ? "+" : rule.type === "expense" ? "−" : ""}
          <Amount value={BigInt(rule.amount)} signDisplay="never" />
        </span>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-touch"
            className="my-auto shrink-0 rounded-full"
            aria-label={`Actions for ${title}`}
            disabled={pending}
          >
            <EllipsisVertical className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <MenuItem icon={Pencil} label="Edit" onSelect={onEdit} />

          {onSkip ? (
            <MenuItem
              icon={SkipForward}
              label="Skip next occurrence"
              onSelect={onSkip}
            />
          ) : null}

          {onPause ? (
            <MenuItem icon={Pause} label="Pause" onSelect={onPause} />
          ) : null}

          {onResume ? (
            <MenuItem icon={Play} label="Resume" onSelect={onResume} />
          ) : null}

          <DropdownMenuSeparator />

          <MenuItem
            icon={Trash2}
            label="Delete"
            onSelect={onDelete}
            variant="destructive"
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

/** A menu row with a thumb-sized target (CLAUDE.md: >= 44px). */
function MenuItem({
  icon: Icon,
  label,
  onSelect,
  variant,
}: {
  icon: LucideIcon;
  label: string;
  onSelect: () => void;
  variant?: "default" | "destructive";
}) {
  return (
    <DropdownMenuItem
      variant={variant}
      onSelect={onSelect}
      className="min-h-11 gap-2 px-2"
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </DropdownMenuItem>
  );
}
