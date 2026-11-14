"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Pause, Pencil, Play, SkipForward, Trash2 } from "lucide-react";

import { DeleteRuleDialog } from "@/components/recurring/delete-rule-dialog";
import { RuleSheet } from "@/components/recurring/rule-sheet";
import { useRuleActions } from "@/components/recurring/use-rule-actions";
import type {
  AccountOption,
  CategoryOption,
} from "@/components/shared/entry-pickers";
import { Button } from "@/components/ui/button";
import { type RecurringRule, ruleTitle } from "@/lib/recurring-rule";

/**
 * Edit, pause, skip and delete for one rule.
 *
 * The same four actions the list offers from its menu, spelled out as buttons
 * here: the detail page is where someone lands when they want to change
 * something, so hiding them behind a menu would be one tap too many.
 */
export function RuleActions({
  rule,
  accounts,
  categories,
  today,
}: {
  rule: RecurringRule;
  accounts: AccountOption[];
  categories: CategoryOption[];
  today: string;
}) {
  const router = useRouter();
  const { pending, pause, resume, skip, remove } = useRuleActions();
  const [editing, setEditing] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      <Button
        variant="outline"
        size="touch"
        onClick={() => setEditing(true)}
        disabled={pending}
      >
        <Pencil className="size-4" aria-hidden="true" />
        Edit
      </Button>

      {rule.active ? (
        <Button
          variant="outline"
          size="touch"
          onClick={() => void pause(rule)}
          disabled={pending}
        >
          <Pause className="size-4" aria-hidden="true" />
          Pause
        </Button>
      ) : (
        <Button
          variant="outline"
          size="touch"
          onClick={() => void resume(rule)}
          disabled={pending}
        >
          <Play className="size-4" aria-hidden="true" />
          Resume
        </Button>
      )}

      <Button
        variant="outline"
        size="touch"
        onClick={() => void skip(rule)}
        disabled={pending || !rule.active || !rule.dueOn}
      >
        <SkipForward className="size-4" aria-hidden="true" />
        Skip next
      </Button>

      <Button
        variant="outline"
        size="touch"
        className="text-destructive hover:text-destructive"
        onClick={() => setDeleting(true)}
        disabled={pending}
      >
        <Trash2 className="size-4" aria-hidden="true" />
        Delete
      </Button>

      <RuleSheet
        open={editing}
        onOpenChange={setEditing}
        rule={rule}
        accounts={accounts}
        categories={categories}
        today={today}
      />

      <DeleteRuleDialog
        open={deleting}
        onOpenChange={setDeleting}
        name={ruleTitle(rule)}
        recordCount={rule.recordCount}
        pending={pending}
        onConfirm={(deleteTransactions) => {
          setDeleting(false);
          // The rule this page is about no longer exists, so staying here
          // would mean rendering a 404.
          void remove(rule, deleteTransactions, () =>
            router.replace("/recurring"),
          );
        }}
      />
    </div>
  );
}
