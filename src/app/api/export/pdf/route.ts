import { NextResponse } from "next/server";

import { type DocumentProps, renderToStream } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";

import {
  ReportDocument,
  type ReportCategory,
} from "@/lib/export/report-document";
import { fromDb } from "@/lib/money";
import { DEFAULT_TIME_ZONE } from "@/lib/month-param";
import { currencyOf, getProfile, getSessionUser } from "@/lib/profile";
import { getAllExportRows } from "@/lib/queries/export";
import { rangeToInstants } from "@/lib/schemas/export";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Past this the statement stops being a document and becomes a database. */
const MAX_ROWS = 1200;

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

const MONTH_LABEL = new Intl.DateTimeFormat("en-IN", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

/**
 * The monthly statement, as a PDF.
 *
 * One month rather than an arbitrary range: a statement is a thing with a
 * period on the front of it, the budget column only means anything against a
 * month, and "any two dates" is what the CSV is for.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const url = new URL(request.url);
  const month = url.searchParams.get("m") ?? "";

  if (!MONTH.test(month)) {
    return NextResponse.json(
      { error: "Pick a month like 2026-11." },
      { status: 400 },
    );
  }

  const profile = await getProfile();
  const timeZone = profile?.timezone ?? DEFAULT_TIME_ZONE;
  const currency = currencyOf(profile);

  const monthStart = `${month}-01`;
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0))
    .toISOString()
    .slice(0, 10);

  const range = rangeToInstants({ from: monthStart, to: lastDay }, timeZone);
  if (!range) {
    return NextResponse.json({ error: "Pick a month." }, { status: 400 });
  }

  const supabase = await createClient();

  // The same RPC the Records strip and Budgets read, so the statement cannot
  // disagree with what the app showed when it was printed.
  let summary;
  let budgets;
  let rows;

  try {
    [summary, budgets, rows] = await Promise.all([
      supabase.rpc("month_summary", { p_month: monthStart }).maybeSingle(),
      supabase
        .from("budgets")
        .select("amount, category:categories(name)")
        .eq("month", monthStart),
      getAllExportRows(supabase, range.startsAt, range.endsAt, MAX_ROWS + 1),
    ]);
  } catch (thrown) {
    console.error("[export]", thrown);
    return NextResponse.json(
      { error: "Could not build the report." },
      { status: 500 },
    );
  }

  // A statement whose budget column is silently empty is worse than no
  // statement: it reads as "you had no budgets", which may be untrue.
  const failed = summary.error ?? budgets.error;

  if (failed) {
    console.error("[export]", failed.message);
    return NextResponse.json(
      { error: "Could not build the report." },
      { status: 500 },
    );
  }

  const budgetByName = new Map<string, bigint>();
  for (const row of (budgets.data ?? []) as unknown as {
    amount: number;
    category: { name: string } | null;
  }[]) {
    if (row.category?.name) {
      budgetByName.set(row.category.name, fromDb(row.amount));
    }
  }

  const spent = ((summary.data?.categories ?? []) as {
    name: string;
    total: number | string;
  }[]).map((row) => ({ name: row.name, total: fromDb(row.total) }));

  const categories: ReportCategory[] = spent.map((row) => ({
    name: row.name,
    total: row.total,
    budget: budgetByName.get(row.name) ?? null,
  }));

  // A budget with nothing spent against it still belongs in the table: "₹0 of
  // ₹6,000" is the most useful line on the page for someone checking.
  for (const [name, budget] of budgetByName) {
    if (!spent.some((row) => row.name === name)) {
      categories.push({ name, total: 0n, budget });
    }
  }

  categories.sort((a, b) => (b.total > a.total ? 1 : b.total < a.total ? -1 : 0));

  const truncated = rows.length > MAX_ROWS;
  const label = MONTH_LABEL.format(new Date(`${monthStart}T00:00:00Z`));

  // renderToStream insists on a <Document> element rather than a component
  // that renders one, which is a limitation of its types and not of what it
  // accepts at runtime.
  const element = createElement(ReportDocument, {
      data: {
        title: "Monthly statement",
        subtitle: label,
        generatedOn: new Intl.DateTimeFormat("en-GB", {
          timeZone,
          dateStyle: "medium",
        }).format(new Date()),
        currency,
        income: fromDb(summary.data?.total_income ?? 0),
        expense: fromDb(summary.data?.total_expense ?? 0),
        categories,
        rows: truncated ? rows.slice(0, MAX_ROWS) : rows,
        truncatedAt: truncated ? MAX_ROWS : null,
        timeZone,
      },
  }) as ReactElement<DocumentProps>;

  let stream;

  try {
    stream = await renderToStream(element);
  } catch (thrown) {
    console.error("[export]", thrown);
    return NextResponse.json(
      { error: "Could not build the report." },
      { status: 500 },
    );
  }

  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="paisa-statement-${month}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
