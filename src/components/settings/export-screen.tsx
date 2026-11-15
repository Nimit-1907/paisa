"use client";

import * as React from "react";

import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dayDifference } from "@/lib/recurrence";
import { MAX_EXPORT_DAYS } from "@/lib/schemas/export";

/**
 * Downloading your records.
 *
 * Both exports are plain GETs to a route handler, so the browser's own
 * download machinery does the work — a fetch into a blob would hold the whole
 * file in memory first, which is the thing the streaming route exists to
 * avoid.
 *
 * The request still has to go through fetch to notice a failure, because a
 * navigation to a 500 replaces the page with an error document. So: fetch,
 * check, then hand the blob to a link.
 */
export function ExportScreen({
  defaultFrom,
  defaultTo,
  defaultMonth,
  monthOptions,
}: {
  defaultFrom: string;
  defaultTo: string;
  /** `yyyy-mm`. */
  defaultMonth: string;
  monthOptions: { value: string; label: string }[];
}) {
  const [from, setFrom] = React.useState(defaultFrom);
  const [to, setTo] = React.useState(defaultTo);
  const [month, setMonth] = React.useState(defaultMonth);
  const [busy, setBusy] = React.useState<"csv" | "pdf" | null>(null);

  const rangeError =
    !from || !to
      ? "Pick both dates."
      : from > to
        ? "The start is after the end."
        : dayDifference(from, to) > MAX_EXPORT_DAYS
          ? "Export at most three years at a time."
          : null;

  async function download(kind: "csv" | "pdf") {
    setBusy(kind);

    const url =
      kind === "csv"
        ? `/api/export/csv?from=${from}&to=${to}`
        : `/api/export/pdf?m=${month}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        toast.error(body?.error ?? "Could not build that file.");
        return;
      }

      const blob = await response.blob();
      const name =
        /filename="([^"]+)"/.exec(
          response.headers.get("content-disposition") ?? "",
        )?.[1] ?? (kind === "csv" ? "paisa.csv" : "paisa.pdf");

      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = name;
      document.body.append(link);
      link.click();
      link.remove();
      // Released on the next tick: revoking it immediately races the click in
      // some browsers and the download arrives empty.
      setTimeout(() => URL.revokeObjectURL(href), 1000);

      toast.success(`${name} downloaded`);
    } catch (thrown) {
      console.error("[export]", thrown);
      toast.error("Could not download that. Check your connection.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="bg-card space-y-4 rounded-card border p-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <FileSpreadsheet
              className="text-ink-2 size-4"
              aria-hidden="true"
            />
            Records as CSV
          </h2>
          <p className="text-ink-2 mt-1 text-xs">
            Every record between two dates: date, type, category, account,
            amount and note. Opens in Excel, Numbers or Sheets.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <FormRow id="export-from" label="From">
            {(props) => (
              <Input
                {...props}
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            )}
          </FormRow>

          <FormRow id="export-to" label="To">
            {(props) => (
              <Input
                {...props}
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            )}
          </FormRow>
        </div>

        {rangeError ? (
          <p role="alert" className="text-destructive text-sm">
            {rangeError}
          </p>
        ) : null}

        <Button
          size="touch"
          className="w-full"
          disabled={busy !== null || rangeError !== null}
          onClick={() => void download("csv")}
        >
          {busy === "csv" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <FileSpreadsheet className="size-4" aria-hidden="true" />
          )}
          Download CSV
        </Button>
      </section>

      <section className="bg-card space-y-4 rounded-card border p-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <FileText
              className="text-ink-2 size-4"
              aria-hidden="true"
            />
            Monthly statement
          </h2>
          <p className="text-ink-2 mt-1 text-xs">
            A printable PDF for one month: the summary, spending by category
            against your budgets, and the full list of records.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="export-month">Month</Label>
          <select
            id="export-month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="border-input bg-background focus-visible:ring-ring h-11 w-full rounded-card border px-3 text-base focus-visible:ring-2 focus-visible:outline-none"
          >
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <Button
          variant="outline"
          size="touch"
          className="w-full"
          disabled={busy !== null}
          onClick={() => void download("pdf")}
        >
          {busy === "pdf" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <FileText className="size-4" aria-hidden="true" />
          )}
          Download PDF
        </Button>
      </section>
    </div>
  );
}
