"use client";

import * as React from "react";

import { ChevronDown } from "lucide-react";

import {
  type AccountOption,
  CategoryGrid,
  type CategoryOption,
} from "@/components/shared/entry-pickers";
import {
  ResponsiveSheet,
  SheetBody,
} from "@/components/shared/responsive-sheet";
import { Tile } from "@/components/shared/tile";
import { TilePicker } from "@/components/shared/tile-picker";
import { PRESSABLE } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * A labelled button that shows what was chosen and opens the choice.
 *
 * The Add Record screen's Account and Category (From and To for a
 * transfer): the reference's two side-by-side boxes. The grids they open
 * are the app's own tile pickers, in a sheet over the screen.
 */
export function PickerButton({
  id,
  label,
  chosen,
  invalid = false,
  onClick,
}: {
  id: string;
  label: string;
  chosen: { name: string; icon: string | null; tint: string | null } | null;
  invalid?: boolean;
  onClick: () => void;
}) {
  const labelId = `${id}-label`;

  return (
    <div className="min-w-0 space-y-1">
      <span
        id={labelId}
        aria-hidden="true"
        className="text-text-secondary block text-center text-xs font-medium"
      >
        {label}
      </span>
      <button
        type="button"
        id={id}
        // "Account: Cash", "Category: Choose": the label first, then what
        // is chosen, which is what the screen shows read top to bottom.
        aria-label={`${label}: ${chosen ? chosen.name : "Choose"}`}
        aria-haspopup="dialog"
        onClick={onClick}
        className={cn(
          PRESSABLE,
          "bg-surface hoverable:bg-surface-muted rounded-control flex h-12 w-full min-w-0 items-center gap-2 border px-2.5 text-left text-sm font-semibold",
          "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
          invalid && "border-expense ring-expense ring-1",
        )}
      >
        {chosen ? (
          <>
            <Tile tint={chosen.tint} icon={chosen.icon} size="sm" />
            <span className="min-w-0 flex-1 truncate">{chosen.name}</span>
          </>
        ) : (
          <span className="text-text-secondary min-w-0 flex-1 truncate pl-1 font-normal">
            Choose
          </span>
        )}
        <ChevronDown
          className="text-text-secondary size-4 shrink-0"
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

/** Account (or From, or To): the button, and the sheet of account tiles. */
export function AccountPicker({
  id,
  label,
  accounts,
  value,
  onChange,
  invalid,
}: {
  id: string;
  label: string;
  accounts: AccountOption[];
  value: string;
  onChange: (id: string) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const chosen = accounts.find((account) => account.id === value) ?? null;

  return (
    <>
      <PickerButton
        id={id}
        label={label}
        chosen={chosen}
        invalid={invalid}
        onClick={() => setOpen(true)}
      />
      <ResponsiveSheet
        open={open}
        onOpenChange={setOpen}
        title={label === "Account" ? "Choose an account" : `${label} account`}
      >
        <SheetBody>
          <TilePicker
            label={label}
            value={value || null}
            onChange={(next) => {
              onChange(next);
              setOpen(false);
            }}
            options={accounts.map((account) => ({
              id: account.id,
              name: account.name,
              icon: account.icon,
              tint: account.tint,
            }))}
          />
        </SheetBody>
      </ResponsiveSheet>
    </>
  );
}

/** Category: the button, and the sheet with the whole category grid. */
export function CategoryPicker({
  id,
  categories,
  value,
  onChange,
  hint,
  invalid,
}: {
  id: string;
  categories: CategoryOption[];
  value: string;
  onChange: (id: string) => void;
  /** "Usually in the evening", when the usual ones are sorted first. */
  hint?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const chosen = categories.find((category) => category.id === value) ?? null;

  return (
    <>
      <PickerButton
        id={id}
        label="Category"
        chosen={chosen}
        invalid={invalid}
        onClick={() => setOpen(true)}
      />
      <ResponsiveSheet
        open={open}
        onOpenChange={setOpen}
        title="Choose a category"
      >
        <SheetBody>
          <CategoryGrid
            categories={categories}
            value={value}
            fold={false}
            showLabel={false}
            hint={hint}
            onChange={(next) => {
              onChange(next);
              setOpen(false);
            }}
          />
        </SheetBody>
      </ResponsiveSheet>
    </>
  );
}
