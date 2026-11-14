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
import { EmptyState } from "@/components/empty-state";
import { useFormatMoney } from "@/components/profile-provider";
import { AddRecordButton } from "@/components/records/add-record-button";
import { DeleteRuleDialog } from "@/components/recurring/delete-rule-dialog";
import { RuleAvatar } from "@/components/recurring/rule-avatar";
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
import { relativeDay } from "@/lib/relative-day";
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

  return (
    <div className="space-y-6">
      <Section
        title="Active"
        count={active.length}
        empty="Nothing is scheduled right now."
      >
        {active.map((rule) => (
          <RuleItem
            key={rule.id}
            rule={rule}
            today={today}
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
              today={today}
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
      <h2 className="text-muted-foreground mb-1.5 px-1 text-xs font-semibold tracking-wider uppercase">
        {title} · {count}
      </h2>

      {count === 0 ? (
        empty ? (
          <p className="text-muted-foreground bg-card rounded-xl border border-dashed px-4 py-6 text-center text-sm">
            {empty}
          </p>
        ) : null
      ) : (
        <ul className="bg-card divide-border divide-y overflow-hidden rounded-xl border">
          {children}
        </ul>
      )}
    </section>
  );
}

function RuleItem({
  rule,
  today,
  pending,
  onEdit,
  onDelete,
  onPause,
  onResume,
  onSkip,
}: {
  rule: RecurringRule;
  today: string;
  pending: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onSkip?: () => void;
}) {
  const formatMoney = useFormatMoney();
  const title = ruleTitle(rule);

  return (
    <li className="flex items-stretch">
      <Link
        href={`/recurring/${rule.id}`}
        className="hoverable:bg-muted/50 focus-visible:ring-ring flex min-h-16 min-w-0 flex-1 items-center gap-2.5 py-2 pl-3 transition-colors focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
      >
        <RuleAvatar rule={rule} dimmed={!rule.active} />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{title}</span>
          <span className="text-muted-foreground block truncate text-xs">
            {describeSchedule(scheduleOf(rule))} · {rule.accountName}
          </span>
          <span
            className={cn(
              "block truncate text-xs",
              rule.active ? "text-primary" : "text-muted-foreground",
            )}
          >
            {rule.active
              ? rule.dueOn
                ? `Next ${relativeDay(rule.dueOn, today)}`
                : "Finished"
              : "Paused"}
          </span>
        </span>

        <span
          className={cn(
            "amount shrink-0 text-right text-sm font-semibold",
            rule.type === "income" && "text-income",
            rule.type === "transfer" && "text-transfer",
            !rule.active && "text-muted-foreground",
          )}
        >
          {rule.type === "income" ? "+" : rule.type === "expense" ? "−" : ""}
          {formatMoney(BigInt(rule.amount), { signDisplay: "never" })}
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
