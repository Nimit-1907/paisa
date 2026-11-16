"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { CheckCircle2, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";

import {
  findExistingRecords,
  getCategoryGuesses,
  importRecords,
} from "@/actions/import";
import { ColumnStep } from "@/components/import/column-step";
import { FileStep } from "@/components/import/file-step";
import { PreviewStep, type PreviewItem } from "@/components/import/preview-step";
import type { ImportAccount, ImportCategory } from "@/components/import/types";
import { useCurrency } from "@/components/profile-provider";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { StickyActionBar } from "@/components/shared/sticky-action-bar";
import { Card } from "@/components/shared/surface";
import { Button } from "@/components/ui/button";
import { type KeywordMap, guessCategory } from "@/lib/import/category-guess";
import { type ColumnMapping, autoMap } from "@/lib/import/columns";
import { type ParsedCsv, parseCsv } from "@/lib/import/csv";
import type { DateFormat } from "@/lib/import/date-text";
import { markDuplicates } from "@/lib/import/duplicates";
import {
  type SignConvention,
  buildImportRows,
  mappingProblem,
} from "@/lib/import/rows";
import { MAX_IMPORT_ROWS } from "@/lib/schemas/import";

const MAX_BYTES = 2 * 1024 * 1024;

type Existing =
  | { status: "loading"; key: string }
  | { status: "ready"; key: string; keys: Set<string> }
  | { status: "failed"; key: string; error: string };

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/**
 * Import: a file, its columns, a preview, then one insert.
 *
 * Everything up to the last step happens on the device. The file is read
 * here and never stored; the server is asked only what the chosen account
 * already has over the file's dates, so the preview can say which rows are
 * duplicates, and at the end it receives the rows themselves, which it
 * checks again before writing any of them.
 */
export function ImportScreen({
  accounts,
  categories,
}: {
  accounts: ImportAccount[];
  categories: ImportCategory[];
}) {
  const router = useRouter();
  const currency = useCurrency();

  const [file, setFile] = React.useState<{ name: string; parsed: ParsedCsv } | null>(
    null,
  );
  const [mapping, setMapping] = React.useState<ColumnMapping | null>(null);
  const [dateFormat, setDateFormat] = React.useState<DateFormat>("dmy");
  const [sign, setSign] = React.useState<SignConvention>("negative-spent");
  const [accountId, setAccountId] = React.useState<string | null>(
    accounts.length === 1 ? accounts[0].id : null,
  );
  const [fallback, setFallback] = React.useState<{
    expense: string | null;
    income: string | null;
  }>({ expense: null, income: null });
  const [overrides, setOverrides] = React.useState<Record<number, string>>({});
  const [existing, setExisting] = React.useState<Existing | null>(null);
  const [keywords, setKeywords] = React.useState<KeywordMap | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<{ imported: number; skipped: number } | null>(
    null,
  );

  const categoryById = React.useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  async function readFile(chosen: File) {
    if (chosen.size > MAX_BYTES) {
      toast.error("That file is over 2 MB. Split it and import each part.");
      return;
    }

    let parsed: ParsedCsv;
    try {
      parsed = parseCsv(await chosen.text());
    } catch (thrown) {
      console.error("[import]", thrown);
      toast.error("Could not read that file.");
      return;
    }

    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      toast.error("That file has no rows under its header.");
      return;
    }

    setFile({ name: chosen.name, parsed });
    setMapping(autoMap(parsed.headers));
    setOverrides({});
    setDone(null);
  }

  const hasFile = file !== null;

  // The guesses, once, when there is first a file to guess for. A failure
  // costs only the guesses: the fallback categories cover every row.
  React.useEffect(() => {
    if (!hasFile || keywords) return;

    let current = true;
    const none: KeywordMap = { expense: {}, income: {} };

    getCategoryGuesses()
      .then((result) => {
        if (current) setKeywords(result.ok ? result.data : none);
      })
      .catch((thrown: unknown) => {
        console.error("[import]", thrown);
        if (current) setKeywords(none);
      });

    return () => {
      current = false;
    };
  }, [hasFile, keywords]);

  const problem = mapping ? mappingProblem(mapping) : null;

  const built = React.useMemo(
    () =>
      file && mapping && !problem
        ? buildImportRows(file.parsed, mapping, {
            dateFormat,
            sign,
            decimals: currency.decimals,
          })
        : null,
    [file, mapping, problem, dateFormat, sign, currency.decimals],
  );

  const range = React.useMemo(() => {
    if (!built?.rows.length) return null;
    const dates = built.rows.map((row) => row.date).sort();
    return { from: dates[0], to: dates[dates.length - 1] };
  }, [built]);

  const lookupKey =
    accountId && range ? `${accountId}|${range.from}|${range.to}` : null;

  // What the account already has over the file's dates, asked once per
  // account and range. A later answer for a different question is dropped.
  React.useEffect(() => {
    if (!lookupKey || !accountId || !range) return;

    let current = true;
    setExisting({ status: "loading", key: lookupKey });

    findExistingRecords({ accountId, ...range })
      .then((result) => {
        if (!current) return;
        setExisting(
          result.ok
            ? { status: "ready", key: lookupKey, keys: new Set(result.data.keys) }
            : { status: "failed", key: lookupKey, error: result.error },
        );
      })
      .catch((thrown: unknown) => {
        console.error("[import]", thrown);
        if (current) {
          setExisting({
            status: "failed",
            key: lookupKey,
            error: "Could not check for duplicates. Check your connection.",
          });
        }
      });

    return () => {
      current = false;
    };
    // `lookupKey` stands for the account and the range together.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookupKey]);

  const lookup = existing && existing.key === lookupKey ? existing : null;

  const items = React.useMemo<PreviewItem[]>(() => {
    if (!built || !keywords) return [];
    const keys = lookup?.status === "ready" ? lookup.keys : new Set<string>();
    const duplicates = markDuplicates(built.rows, keys);

    return built.rows.map((row, index) => {
      const guess = guessCategory(keywords, row.type, row.note);
      const override = overrides[row.line];
      const chosen = override ?? guess ?? fallback[row.type];
      const category = chosen ? (categoryById.get(chosen) ?? null) : null;

      return {
        row,
        duplicate: duplicates[index],
        category: category?.kind === row.type ? category : null,
        guessed: !override && Boolean(guess),
      };
    });
  }, [built, lookup, keywords, overrides, fallback, categoryById]);

  const toImport = items.filter((item) => item.duplicate === null);
  const duplicateCount = items.length - toImport.length;
  const missing = toImport.filter((item) => !item.category).length;
  const checking =
    !keywords ||
    lookup?.status === "loading" ||
    (lookupKey !== null && !lookup);

  const blocker = !file
    ? null
    : problem
      ? problem
      : !accountId
        ? "Choose the account these records belong to."
        : lookup?.status === "failed"
          ? lookup.error
          : toImport.length > MAX_IMPORT_ROWS
            ? "Import at most 2,000 records at a time. Split the file and import each part."
            : missing > 0
              ? `Choose a category for ${plural(missing, "row", "rows")}, or set a fallback.`
              : null;

  async function submit() {
    if (!accountId || !built) return;
    setBusy(true);

    try {
      const result = await importRecords({
        accountId,
        rows: toImport.map((item) => ({
          type: item.row.type,
          amount: item.row.amount.toString(),
          date: item.row.date,
          note: item.row.note,
          categoryId: item.category?.id ?? "",
        })),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const skipped =
        result.data.skipped + duplicateCount + built.unreadable.length;

      toast.success(
        `Imported ${plural(result.data.imported, "record", "records")}, ${skipped} skipped`,
        {
          action: {
            label: "View records",
            onClick: () => router.push("/records"),
          },
        },
      );

      setDone({ imported: result.data.imported, skipped });
      setFile(null);
      setMapping(null);
      setExisting(null);
    } catch (thrown) {
      console.error("[import]", thrown);
      toast.error("Could not import. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="No open accounts"
        description="Records are imported into an account. Add one first."
        action={
          <Button asChild size="touch">
            <Link href="/accounts">Go to Accounts</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {done ? (
        <Card className="flex items-start gap-3 p-4" as="section">
          <CheckCircle2 className="text-income size-6 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h2 className="text-base font-semibold">
                Imported {plural(done.imported, "record", "records")}
              </h2>
              <p className="text-text-secondary text-sm">
                {done.skipped === 0
                  ? "Nothing was skipped."
                  : `${plural(done.skipped, "row was", "rows were")} skipped as duplicates or unreadable.`}
              </p>
            </div>
            <Button asChild size="touch" variant="secondary">
              <Link href="/records">Go to Records</Link>
            </Button>
          </div>
        </Card>
      ) : null}

      <section className="space-y-2">
        <SectionHeader className="px-1" title="File" />
        <FileStep fileName={file?.name ?? null} onFile={(chosen) => void readFile(chosen)} />
      </section>

      {file && mapping ? (
        <>
          <section className="space-y-2">
            <SectionHeader
              className="px-1"
              title="Columns"
              description="Matched from the header row. Change any that are wrong."
            />
            <ColumnStep
              headers={file.parsed.headers}
              mapping={mapping}
              onMapping={setMapping}
              dateFormat={dateFormat}
              onDateFormat={setDateFormat}
              sign={sign}
              onSign={setSign}
              accounts={accounts}
              accountId={accountId}
              onAccount={setAccountId}
              problem={problem}
            />
          </section>

          {built ? (
            <PreviewStep
              items={items}
              toImport={toImport.length}
              duplicates={duplicateCount}
              unreadable={built.unreadable}
              checking={checking}
              categories={categories}
              fallback={fallback}
              onFallback={(type, id) =>
                setFallback((current) => ({ ...current, [type]: id }))
              }
              onCategory={(line, id) =>
                setOverrides((current) => ({ ...current, [line]: id }))
              }
            />
          ) : null}

          {/* Held above the floating dock on a phone (its 12px inset and
              60px height), and against the bottom edge once the dock has
              become the sidebar. Inset like the cards around it, so it is
              a card itself rather than a strip with no edges. */}
          <StickyActionBar className="rounded-card bottom-[calc(4.75rem+env(safe-area-inset-bottom))] flex-col border pb-3 lg:bottom-4">
            {blocker ? (
              <p className="text-text-secondary text-sm">{blocker}</p>
            ) : null}
            <Button
              size="touch"
              className="w-full"
              disabled={
                busy || checking || blocker !== null || toImport.length === 0
              }
              onClick={() => void submit()}
            >
              {busy || checking ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {checking
                ? "Checking for duplicates"
                : toImport.length === 0
                  ? "Nothing to import"
                  : `Import ${plural(toImport.length, "record", "records")}`}
            </Button>
          </StickyActionBar>
        </>
      ) : null}
    </div>
  );
}
