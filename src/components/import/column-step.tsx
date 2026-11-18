"use client";

import { SegmentedControl } from "@/components/shared/segmented-control";
import { Card } from "@/components/shared/surface";
import { FormRow } from "@/components/ui/form-row";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import type { ImportAccount } from "@/components/import/types";
import type { AmountMode, ColumnMapping } from "@/lib/import/columns";
import { DATE_FORMATS, type DateFormat } from "@/lib/import/date-text";
import type { SignConvention } from "@/lib/import/rows";

const NONE = "none";

/** A column's name, or its position when the header cell is empty. */
export function columnLabel(headers: string[], index: number): string {
  return headers[index] || `Column ${index + 1}`;
}

function ColumnSelect({
  id,
  label,
  headers,
  value,
  onChange,
  required = false,
}: {
  id: string;
  label: string;
  headers: string[];
  value: number | null;
  onChange: (next: number | null) => void;
  required?: boolean;
}) {
  return (
    <FormRow id={id} label={label} required={required}>
      {(field) => (
        <Select
          value={value === null ? NONE : String(value)}
          onValueChange={(next) =>
            onChange(next === NONE ? null : Number(next))
          }
        >
          <SelectTrigger {...field}>
            {value === null
              ? required
                ? "Choose a column"
                : "None"
              : columnLabel(headers, value)}
          </SelectTrigger>
          <SelectContent>
            {required ? null : <SelectItem value={NONE}>None</SelectItem>}
            {headers.map((_, index) => (
              <SelectItem key={index} value={String(index)}>
                {columnLabel(headers, index)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FormRow>
  );
}

/**
 * Step 2: which column is which, and which account it all goes to.
 *
 * Filled in from the header row already; this is where a guess that missed
 * is put right.
 */
export function ColumnStep({
  headers,
  mapping,
  onMapping,
  dateFormat,
  onDateFormat,
  sign,
  onSign,
  accounts,
  accountId,
  onAccount,
  problem,
}: {
  headers: string[];
  mapping: ColumnMapping;
  onMapping: (next: ColumnMapping) => void;
  dateFormat: DateFormat;
  onDateFormat: (next: DateFormat) => void;
  sign: SignConvention;
  onSign: (next: SignConvention) => void;
  accounts: ImportAccount[];
  accountId: string | null;
  onAccount: (next: string) => void;
  problem: string | null;
}) {
  const set = (patch: Partial<ColumnMapping>) =>
    onMapping({ ...mapping, ...patch });

  return (
    <Card className="space-y-4 p-4">
      <FormRow id="import-account" label="Account" required>
        {(field) => (
          <Select value={accountId ?? undefined} onValueChange={onAccount}>
            <SelectTrigger {...field}>
              {accounts.find((account) => account.id === accountId)?.name ??
                "Choose an account"}
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormRow>

      <div className="grid gap-4 sm:grid-cols-2">
        <ColumnSelect
          id="import-date"
          label="Date"
          required
          headers={headers}
          value={mapping.date}
          onChange={(date) => set({ date })}
        />

        <FormRow id="import-date-format" label="Date format">
          {(field) => (
            <Select
              value={dateFormat}
              onValueChange={(next) => onDateFormat(next as DateFormat)}
            >
              <SelectTrigger {...field}>
                {
                  DATE_FORMATS.find((format) => format.value === dateFormat)
                    ?.label
                }
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map((format) => (
                  <SelectItem key={format.value} value={format.value}>
                    {format.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormRow>
      </div>

      <SegmentedControl<AmountMode>
        label="Amount columns"
        value={mapping.mode}
        onChange={(mode) => set({ mode })}
        options={[
          { value: "single", label: "One amount" },
          { value: "split", label: "Debit and credit" },
        ]}
      />

      {mapping.mode === "single" ? (
        <>
          <ColumnSelect
            id="import-amount"
            label="Amount"
            required
            headers={headers}
            value={mapping.amount}
            onChange={(amount) => set({ amount })}
          />
          <ColumnSelect
            id="import-type"
            label="Type (expense or income)"
            headers={headers}
            value={mapping.type}
            onChange={(type) => set({ type })}
          />
          {/* Only asked when no column says it: with a Type column, the
              sign of the amount decides nothing. */}
          {mapping.type === null ? (
            <SegmentedControl<SignConvention>
              label="Which amounts are spending"
              value={sign}
              onChange={onSign}
              options={[
                { value: "negative-spent", label: "Negative is spent" },
                { value: "positive-spent", label: "Positive is spent" },
              ]}
            />
          ) : null}
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <ColumnSelect
            id="import-debit"
            label="Debit (spent)"
            required
            headers={headers}
            value={mapping.debit}
            onChange={(debit) => set({ debit })}
          />
          <ColumnSelect
            id="import-credit"
            label="Credit (received)"
            required
            headers={headers}
            value={mapping.credit}
            onChange={(credit) => set({ credit })}
          />
        </div>
      )}

      <ColumnSelect
        id="import-description"
        label="Description"
        headers={headers}
        value={mapping.description}
        onChange={(description) => set({ description })}
      />

      {problem ? (
        <p role="alert" className="text-expense text-sm">
          {problem}
        </p>
      ) : null}
    </Card>
  );
}
