import { NextResponse } from "next/server";

import { RECORD_COLUMNS, UTF8_BOM, csvRow } from "@/lib/export/csv";
import { formatWith } from "@/lib/money";
import { DEFAULT_TIME_ZONE } from "@/lib/month-param";
import { currencyOf, getProfile, getSessionUser } from "@/lib/profile";
import { EXPORT_PAGE_SIZE, getExportPage } from "@/lib/queries/export";
import { createClient } from "@/lib/supabase/server";
import { exportRangeSchema, rangeToInstants } from "@/lib/schemas/export";

// Node, not edge: this streams from Supabase over a cookie-authenticated
// client and has no reason to run anywhere else.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Records for a date range, as CSV.
 *
 * Streamed a page at a time rather than built into one string: an export can
 * cover years, and the point of a download is that the browser can start
 * writing it to disk while the server is still reading.
 *
 * RLS does the authorising — the client is the caller's — but the session is
 * checked first so an expired cookie gets a 401 rather than an empty file
 * that looks like "you have no records".
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = exportRangeSchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Pick a date range." },
      { status: 400 },
    );
  }

  const profile = await getProfile();
  const timeZone = profile?.timezone ?? DEFAULT_TIME_ZONE;
  const currency = currencyOf(profile);
  const range = rangeToInstants(parsed.data, timeZone);

  if (!range) {
    return NextResponse.json({ error: "Pick a date range." }, { status: 400 });
  }

  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // Built here, inside the request, because the stream's pull runs after the
  // response has detached from it.
  const supabase = await createClient();
  const encoder = new TextEncoder();

  let offset = 0;
  let finished = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(UTF8_BOM + csvRow([...RECORD_COLUMNS])));
    },

    // One page per pull, not every page in start(): start() runs to
    // completion before the consumer has read anything, so the whole file
    // would sit in the stream's queue — which is the opposite of streaming.
    async pull(controller) {
      if (finished) return;

      try {
        const page = await getExportPage({
          client: supabase,
          startsAt: range.startsAt,
          endsAt: range.endsAt,
          offset,
        });

        for (const row of page) {
          const at = new Date(row.occurredAt);

          controller.enqueue(
            encoder.encode(
              csvRow([
                date.format(at),
                time.format(at),
                row.type,
                row.type === "transfer" ? "" : row.categoryName,
                row.accountName,
                row.toAccountName,
                // Formatted with the user's own currency, which is what the
                // column header promises and what the app shows on screen.
                formatWith(currency, row.amount, { signDisplay: "never" }),
                row.note,
              ]),
            ),
          );
        }

        offset += page.length;

        if (page.length < EXPORT_PAGE_SIZE) {
          finished = true;
          controller.close();
        }
      } catch (thrown) {
        // The headers have already gone out, so there is no status left to
        // change: the best that can be done is to stop and leave the log
        // saying why the file is short.
        console.error("[export]", thrown);
        finished = true;
        controller.error(thrown);
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="paisa-${parsed.data.from}-to-${parsed.data.to}.csv"`,
      "cache-control": "no-store",
    },
  });
}
