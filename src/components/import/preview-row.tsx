"use client";

import * as React from "react";

import { Amount } from "@/components/shared/amount";
import { FieldCard } from "@/components/shared/field-card";
import { ListRow } from "@/components/shared/list-row";
import { Tile } from "@/components/shared/tile";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import type { ImportCategory } from "@/components/import/types";
import type { ImportRow } from "@/lib/import/rows";
import { dateFormat } from "@/lib/date-format";

const DAY = dateFormat({
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "5 Nov 2026", read as a calendar day, never shifted by a timezone. */
export function dayLabel(date: string): string {
  return DAY.format(new Date(`${date}T00:00:00Z`));
}

/**
 * One row of the preview: what it is, and the category it will be filed
 * under. The amount and the date are the file's and are not editable here;
 * the category is, and tapping the row opens the same picker as the field
 * under it.
 */
export function PreviewRow({
  row,
  category,
  guessed,
  options,
  onCategory,
}: {
  row: ImportRow;
  category: ImportCategory | null;
  /** The category came from the person's history, not from them. */
  guessed: boolean;
  options: ImportCategory[];
  onCategory: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const income = row.type === "income";

  return (
    <li>
      <ListRow
        onClick={() => setOpen(true)}
        leading={
          <Tile
            tint={category?.tint ?? "neutral"}
            icon={category?.icon ?? null}
          />
        }
        title={row.note ?? "No description"}
        subtitle={
          <>
            <span>{dayLabel(row.date)}</span>
            <span aria-hidden="true">·</span>
            <span>{income ? "Income" : "Expense"}</span>
          </>
        }
        trailing={
          <span className={income ? "text-income" : "text-expense"}>
            {income ? "+" : "−"}
            <Amount value={row.amount} signDisplay="never" />
          </span>
        }
      />

      <div className="bg-surface px-3 pb-3 pl-[60px]">
        <Select
          open={open}
          onOpenChange={setOpen}
          value={category?.id}
          onValueChange={onCategory}
        >
          <SelectTrigger asChild>
            <FieldCard
              asTrigger
              className="w-full"
              invalid={!category}
              label={guessed ? "Category, from your history" : "Category"}
              value={category?.name ?? "Choose a category"}
              aria-label={`Category for line ${row.line}: ${
                category?.name ?? "none chosen"
              }`}
            />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </li>
  );
}
