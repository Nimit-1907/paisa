"use client";

import * as React from "react";

import { HeroStat } from "@/components/shared/hero-stat";
import { ListCard, Card } from "@/components/shared/surface";
import { SectionHeader } from "@/components/shared/section-header";
import { PreviewRow } from "@/components/import/preview-row";
import type { ImportCategory } from "@/components/import/types";
import { Button } from "@/components/ui/button";
import { FormRow } from "@/components/ui/form-row";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import type { DuplicateKind } from "@/lib/import/duplicates";
import type { ImportRow, Unreadable } from "@/lib/import/rows";

export type PreviewItem = {
  row: ImportRow;
  duplicate: DuplicateKind | null;
  category: ImportCategory | null;
  guessed: boolean;
};

/** Rows drawn at once. Every row is counted; a long file pages. */
const PAGE = 25;

/** The first few reasons, which is usually one mistake made many times. */
const REASONS_SHOWN = 3;

const TYPES = [
  { type: "expense" as const, label: "Fallback for spending" },
  { type: "income" as const, label: "Fallback for income" },
];

/**
 * Step 3: what will be imported.
 *
 * The counts first, then a fallback category per type for the rows the
 * history has no guess for, then the rows themselves, each with its
 * category to change. Duplicates are counted, not listed: they are the rows
 * that will not happen.
 */
export function PreviewStep({
  items,
  toImport,
  duplicates,
  unreadable,
  checking,
  categories,
  fallback,
  onFallback,
  onCategory,
}: {
  items: PreviewItem[];
  toImport: number;
  duplicates: number;
  unreadable: Unreadable[];
  checking: boolean;
  categories: ImportCategory[];
  fallback: { expense: string | null; income: string | null };
  onFallback: (type: "expense" | "income", id: string) => void;
  onCategory: (line: number, id: string) => void;
}) {
  const [shown, setShown] = React.useState(PAGE);
  const rows = items.filter((item) => item.duplicate === null);
  const typesPresent = TYPES.filter(({ type }) =>
    rows.some((item) => item.row.type === type),
  );

  return (
    <section className="space-y-4" aria-label="Preview">
      <SectionHeader className="px-1" title="Preview" />

      <HeroStat
        label="To import"
        value={checking ? "…" : `${toImport} ${toImport === 1 ? "record" : "records"}`}
        helper={
          checking
            ? "Checking for duplicates"
            : `${duplicates} ${duplicates === 1 ? "duplicate" : "duplicates"}, ${unreadable.length} unreadable`
        }
      />

      {unreadable.length > 0 ? (
        <Card className="space-y-1 p-4">
          <h3 className="text-sm font-semibold">Not read</h3>
          <ul className="text-text-secondary space-y-1 text-sm">
            {unreadable.slice(0, REASONS_SHOWN).map((item) => (
              <li key={item.line}>{item.reason}</li>
            ))}
          </ul>
          {unreadable.length > REASONS_SHOWN ? (
            <p className="text-text-secondary text-sm">
              And {unreadable.length - REASONS_SHOWN} more.
            </p>
          ) : null}
        </Card>
      ) : null}

      {typesPresent.length > 0 && !checking ? (
        <Card className="grid gap-4 p-4 sm:grid-cols-2">
          {typesPresent.map(({ type, label }) => {
            const options = categories.filter((category) => category.kind === type);
            const chosen = options.find((category) => category.id === fallback[type]);

            return (
              <FormRow
                key={type}
                id={`import-fallback-${type}`}
                label={label}
                hint="For rows with no guess from your history."
              >
                {(field) => (
                  <Select
                    value={chosen?.id}
                    onValueChange={(id) => onFallback(type, id)}
                  >
                    <SelectTrigger {...field}>
                      {chosen?.name ?? "Choose a category"}
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormRow>
            );
          })}
        </Card>
      ) : null}

      {rows.length > 0 && !checking ? (
        <div className="space-y-2">
          <ListCard>
            {rows.slice(0, shown).map((item) => (
              <PreviewRow
                key={item.row.line}
                row={item.row}
                category={item.category}
                guessed={item.guessed}
                options={categories.filter(
                  (category) => category.kind === item.row.type,
                )}
                onCategory={(id) => onCategory(item.row.line, id)}
              />
            ))}
          </ListCard>

          {rows.length > shown ? (
            <Button
              type="button"
              size="touch"
              variant="secondary"
              className="w-full"
              onClick={() => setShown((current) => current + PAGE)}
            >
              Show {Math.min(PAGE, rows.length - shown)} more of{" "}
              {rows.length - shown}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
