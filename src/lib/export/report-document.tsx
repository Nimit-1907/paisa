import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { CurrencySettings } from "@/lib/money";
import { formatWith } from "@/lib/money";
import type { ExportRow } from "@/lib/queries/export";

/**
 * The monthly statement.
 *
 * Deliberately plain: this is a document someone prints, forwards to an
 * accountant or keeps for seven years, so it is black text on white paper
 * with no theme and no colour carrying meaning on its own. The money colours
 * the app uses do not survive a monochrome printer, so the sign does the
 * work instead.
 */

export type ReportCategory = {
  name: string;
  total: bigint;
  /** The budget for the month, when there is one. */
  budget: bigint | null;
};

export type ReportData = {
  title: string;
  subtitle: string;
  generatedOn: string;
  currency: CurrencySettings;
  income: bigint;
  expense: bigint;
  categories: ReportCategory[];
  rows: ExportRow[];
  /** Set when the record list was cut short. */
  truncatedAt: number | null;
  timeZone: string;
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 10, color: "#4b5563", marginTop: 2 },
  generated: { fontSize: 8, color: "#6b7280", marginTop: 2 },
  section: { marginTop: 18 },
  heading: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 3,
  },
  summaryRow: { flexDirection: "row", gap: 8 },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
    padding: 8,
  },
  summaryLabel: { fontSize: 8, color: "#6b7280" },
  summaryValue: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 2 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    paddingVertical: 4,
  },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    paddingBottom: 3,
    marginBottom: 2,
  },
  th: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#374151" },
  right: { textAlign: "right" },
  muted: { color: "#6b7280" },
  note: { fontSize: 8, color: "#6b7280", marginTop: 8 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 8,
    color: "#9ca3af",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

function Money({
  currency,
  amount,
  sign,
}: {
  currency: CurrencySettings;
  amount: bigint;
  sign?: "always" | "never";
}) {
  return <Text>{formatWith(currency, amount, { signDisplay: sign })}</Text>;
}

export function ReportDocument({ data }: { data: ReportData }) {
  const { currency } = data;
  const net = data.income - data.expense;

  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: data.timeZone,
    day: "2-digit",
    month: "short",
  });

  return (
    <Document
      title={data.title}
      author="Paisa"
      subject="Monthly statement"
      creator="Paisa"
    >
      <Page size="A4" style={styles.page} wrap>
        <View>
          <Text style={styles.title}>{data.title}</Text>
          <Text style={styles.subtitle}>{data.subtitle}</Text>
          <Text style={styles.generated}>Generated {data.generatedOn}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Summary</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Income</Text>
              <Text style={styles.summaryValue}>
                <Money currency={currency} amount={data.income} sign="never" />
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Expense</Text>
              <Text style={styles.summaryValue}>
                <Money currency={currency} amount={data.expense} sign="never" />
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Net</Text>
              <Text style={styles.summaryValue}>
                <Money currency={currency} amount={net} sign="always" />
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Spending by category</Text>

          <View style={styles.headerRow}>
            <Text style={[styles.th, { flex: 3 }]}>Category</Text>
            <Text style={[styles.th, styles.right, { flex: 2 }]}>Spent</Text>
            <Text style={[styles.th, styles.right, { flex: 2 }]}>Budget</Text>
            <Text style={[styles.th, styles.right, { flex: 2 }]}>
              Difference
            </Text>
          </View>

          {data.categories.length === 0 ? (
            <Text style={styles.muted}>No spending in this period.</Text>
          ) : (
            data.categories.map((category) => {
              const left =
                category.budget === null ? null : category.budget - category.total;

              return (
                <View key={category.name} style={styles.row} wrap={false}>
                  <Text style={{ flex: 3 }}>{category.name}</Text>
                  <Text style={[styles.right, { flex: 2 }]}>
                    <Money
                      currency={currency}
                      amount={category.total}
                      sign="never"
                    />
                  </Text>
                  <Text style={[styles.right, styles.muted, { flex: 2 }]}>
                    {category.budget === null ? (
                      "—"
                    ) : (
                      <Money
                        currency={currency}
                        amount={category.budget}
                        sign="never"
                      />
                    )}
                  </Text>
                  <Text style={[styles.right, { flex: 2 }]}>
                    {left === null ? (
                      "—"
                    ) : (
                      <Money currency={currency} amount={left} sign="always" />
                    )}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Records ({data.rows.length})</Text>

          <View style={styles.headerRow}>
            <Text style={[styles.th, { flex: 1.4 }]}>Date</Text>
            <Text style={[styles.th, { flex: 3 }]}>Category / transfer</Text>
            <Text style={[styles.th, { flex: 2.4 }]}>Account</Text>
            <Text style={[styles.th, { flex: 3 }]}>Note</Text>
            <Text style={[styles.th, styles.right, { flex: 2 }]}>Amount</Text>
          </View>

          {data.rows.length === 0 ? (
            <Text style={styles.muted}>No records in this period.</Text>
          ) : (
            data.rows.map((row) => (
              <View key={row.id} style={styles.row} wrap={false}>
                <Text style={{ flex: 1.4 }}>
                  {date.format(new Date(row.occurredAt))}
                </Text>
                <Text style={{ flex: 3 }}>
                  {row.type === "transfer"
                    ? `${row.accountName} to ${row.toAccountName ?? "—"}`
                    : (row.categoryName ?? "Uncategorised")}
                </Text>
                <Text style={[styles.muted, { flex: 2.4 }]}>
                  {row.accountName}
                </Text>
                <Text style={[styles.muted, { flex: 3 }]}>{row.note ?? ""}</Text>
                <Text style={[styles.right, { flex: 2 }]}>
                  {/* The sign carries the direction: this prints in black and
                      white, where a colour would carry nothing at all. */}
                  {row.type === "income" ? "+" : row.type === "expense" ? "-" : ""}
                  <Money currency={currency} amount={row.amount} sign="never" />
                </Text>
              </View>
            ))
          )}

          {data.truncatedAt ? (
            <Text style={styles.note}>
              Only the first {data.truncatedAt} records are listed. Export the
              CSV for the complete set.
            </Text>
          ) : null}
        </View>

        <View style={styles.footer} fixed>
          <Text>Paisa · {data.subtitle}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
