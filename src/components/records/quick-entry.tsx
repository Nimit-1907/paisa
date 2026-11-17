"use client";

import * as React from "react";

import { CornerDownLeft, Zap } from "lucide-react";
import { toast } from "sonner";

import { getCategoryGuesses } from "@/actions/import";
import { useCurrency, useFormatMoney } from "@/components/profile-provider";
import { useRecordSheet } from "@/components/records/record-sheet-provider";
import { Input } from "@/components/ui/input";
import { parseAmount } from "@/lib/amount";
import { nowLocal } from "@/lib/dates";
import { guessAccounts } from "@/lib/entry-account";
import type { KeywordMap } from "@/lib/import/category-guess";
import { parseQuickEntry } from "@/lib/quick-entry";

const NO_KEYWORDS: KeywordMap = { expense: {}, income: {} };

/**
 * One line above the list: "250 chai cash", Enter, saved.
 *
 * Faster than the full Add Record for the small spends of a day. While
 * typing, a line underneath says what Enter will do, so nothing is a
 * surprise. With an amount, a category and an account it saves at once
 * through the same path as Save, toast and Undo included; with anything
 * missing it opens Add Record with what it could read, so the line is
 * never lost.
 *
 * The category comes from the person's own past notes (the guess CSV
 * import makes), loaded the first time the field is focused rather than
 * with the page: most visits never use it.
 */
export function QuickEntry({ timeZone }: { timeZone: string }) {
  const sheet = useRecordSheet();
  const currency = useCurrency();
  const format = useFormatMoney();
  const [text, setText] = React.useState("");
  const [keywords, setKeywords] = React.useState<KeywordMap>(NO_KEYWORDS);
  const [saving, setSaving] = React.useState(false);
  const asked = React.useRef(false);
  const hintId = React.useId();

  const data = sheet.sheetData;
  const accounts = React.useMemo(() => data?.accounts ?? [], [data]);
  const categories = React.useMemo(() => data?.categories ?? [], [data]);

  function loadKeywords() {
    if (asked.current) return;
    asked.current = true;
    getCategoryGuesses()
      .then((result) => {
        if (result.ok) setKeywords(result.data);
      })
      // A guess is a nicety: without it a named category still works, and
      // anything else opens the sheet.
      .catch((thrown: unknown) => console.error("[records]", thrown));
  }

  const parsed = React.useMemo(
    () =>
      text.trim()
        ? parseQuickEntry(text, { accounts, categories, keywords })
        : null,
    [text, accounts, categories, keywords],
  );

  const minor = React.useMemo(() => {
    if (!parsed?.amount) return null;
    const result = parseAmount(parsed.amount, currency.decimals);
    return result.ok && result.minor > 0n ? result.minor : null;
  }, [parsed, currency.decimals]);

  // The account to book to: the one named, else the one this type last used.
  const accountId = React.useMemo(() => {
    if (!parsed || !data) return null;
    if (parsed.accountId) return parsed.accountId;
    return (
      guessAccounts({
        type: parsed.type,
        last: data.entryDefaults.lastAccounts,
        activeAccountIds: accounts.map((account) => account.id),
        current: { accountId: "", toAccountId: "" },
        chosenByHand: false,
      }).accountId || null
    );
  }, [parsed, data, accounts]);

  if (!data || accounts.length === 0) return null;

  const complete = Boolean(minor !== null && parsed?.categoryId && accountId);

  const preview = parsed
    ? [
        minor !== null
          ? format(minor, { signDisplay: "never", paise: "trim" })
          : "No amount",
        parsed.note,
        categories.find((category) => category.id === parsed.categoryId)
          ?.name ?? "No category",
        accounts.find((account) => account.id === accountId)?.name,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  async function submit() {
    if (!parsed || saving) return;

    if (!complete || minor === null || !accountId || !parsed.categoryId) {
      // Not enough to save: the sheet, filled with what was read.
      sheet.openLogAgain({
        id: "quick",
        type: parsed.type,
        amount: minor !== null ? minor.toString() : "0",
        accountId: parsed.accountId ?? "",
        toAccountId: null,
        categoryId: parsed.categoryId,
        note: parsed.note,
        occurredAtLocal: nowLocal(timeZone),
        recurringRuleId: null,
      });
      setText("");
      return;
    }

    setSaving(true);
    try {
      const result = await sheet.save(
        {
          type: parsed.type,
          amount: parsed.amount ?? "",
          accountId,
          toAccountId: null,
          categoryId: parsed.categoryId,
          note: parsed.note,
          occurredAt: nowLocal(timeZone),
        },
        { editingId: null },
      );
      if (result.ok) setText("");
      else toast.error(result.error);
    } catch (thrown) {
      console.error("[records]", thrown);
      toast.error("Could not save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Zap
          className="text-text-secondary pointer-events-none absolute inset-y-0 left-3 my-auto size-4"
          aria-hidden="true"
        />
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onFocus={loadKeywords}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
          disabled={saving}
          aria-label="Quick add"
          aria-describedby={preview ? hintId : undefined}
          placeholder="Quick add: 250 chai cash"
          enterKeyHint="done"
          autoComplete="off"
          className="h-11 pl-9"
        />
      </div>

      {preview ? (
        <p
          id={hintId}
          aria-live="polite"
          className="text-text-secondary flex items-start gap-1.5 px-1 text-xs"
        >
          <CornerDownLeft className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0">
            {complete ? "Enter saves " : "Enter opens Add record: "}
            <span className="text-text font-semibold">{preview}</span>
          </span>
        </p>
      ) : null}
    </div>
  );
}
