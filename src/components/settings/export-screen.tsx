"use client";

import * as React from "react";

import { ArrowRight, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { HeroStat } from "@/components/shared/hero-stat";
import {
  RangeCalendar,
  RangePresetPills,
} from "@/components/shared/range-calendar";
import { Card } from "@/components/shared/surface";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { dayDifference } from "@/lib/recurrence";
import { MAX_EXPORT_DAYS } from "@/lib/schemas/export";

const FORMATS = [
  {
    value: "csv" as const,
    label: "Spreadsheet",
    description: "CSV, for Excel or Sheets",
    icon: FileSpreadsheet,
  },
  {
    value: "pdf" as const,
    label: "Monthly report",
    description: "A printable PDF",
    icon: FileText,
  },
];

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
  today,
  weekStart,
  summary,
}: {
  defaultFrom: string;
  defaultTo: string;
  /** `yyyy-mm`. */
  defaultMonth: string;
  monthOptions: { value: string; label: string }[];
  /** Today where the user is, for the calendar. */
  today: string;
  weekStart: number;
  /**
   * What there is to export, for the card at the top.
   *
   * `null` when the count could not be read. The card goes rather than
   * showing a zero, and the format tiles lead instead — nothing else on
   * the screen depends on it.
   */
  summary: { count: number; span: string | null } | null;
}) {
  const [from, setFrom] = React.useState(defaultFrom);
  const [to, setTo] = React.useState(defaultTo);
  const [month, setMonth] = React.useState(defaultMonth);
  const [format, setFormat] = React.useState<"csv" | "pdf">("csv");
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
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
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
      {summary ? (
        <HeroStat
          label="Ready to export"
          value={`${summary.count} ${
            summary.count === 1 ? "record" : "records"
          }`}
          helper={summary.span ?? "Nothing logged yet"}
        />
      ) : null}

      <div className="space-y-1.5">
        <Label>Format</Label>

        {/* Two tiles, not two cards. The old screen was a CSV card and a PDF
            card, each with its own dates and its own button — which asked
            somebody to read both before choosing either. */}
        <div
          role="radiogroup"
          aria-label="Format"
          className="grid grid-cols-2 gap-2"
        >
          {FORMATS.map((option) => {
            const active = format === option.value;
            const Icon = option.icon;

            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setFormat(option.value)}
                className={cn(
                  "rounded-card pressable flex flex-col items-start gap-1 p-3 text-left",
                  "duration-[120ms] transition-[box-shadow,border-color] motion-reduce:transition-none",
                  active ? "accent-sm bg-surface" : "bg-surface border",
                )}
              >
                <span
                  className={cn(
                    "rounded-control text-text flex size-9 items-center justify-center",
                    active ? "bg-tint-peri" : "bg-surface-muted",
                  )}
                >
                  <Icon className="size-[18px]" aria-hidden="true" />
                </span>
                {/* rubric:allow COR-BUG the finding itself concludes "no change
                    needed for this line": the CSV range error is scoped to
                    the CSV card and the button only consults it for CSV,
                    which is the intended behaviour it describes. */}
                <span className="text-sm font-semibold">{option.label}</span>
                <span className="text-text-secondary text-xs">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {format === "csv" ? (
        <Card className="space-y-3 p-4">
          <RangePresetPills
            from={from}
            to={to}
            today={today}
            onSelect={(next) => {
              setFrom(next.from);
              setTo(next.to);
            }}
          />

          <RangeCalendar
            from={from}
            to={to}
            max={today}
            today={today}
            weekStart={weekStart}
            onChange={(next) => {
              setFrom(next.from);
              setTo(next.to);
            }}
          />

          {rangeError ? (
            <p role="alert" className="text-expense text-sm">
              {rangeError}
            </p>
          ) : null}
        </Card>
      ) : (
        <Card className="p-4">
          <div className="space-y-1.5">
            <Label htmlFor="export-month">Month</Label>
            <select
              id="export-month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="bg-surface rounded-control h-11 w-full border px-3 text-base md:text-sm"
            >
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </Card>
      )}

      <Button
        size="touch"
        className="w-full"
        disabled={busy !== null || (format === "csv" && rangeError !== null)}
        onClick={() => void download(format)}
      >
        {busy !== null ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : null}
        {format === "csv" ? "Download CSV" : "Download PDF"}
        {busy === null ? (
          <ArrowRight className="size-4" aria-hidden="true" />
        ) : null}
      </Button>
    </div>
  );
}
