import type { Metadata } from "next";

import { ImportScreen } from "@/components/import/import-screen";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { getActiveCategories } from "@/lib/queries/categories";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Import" };

/**
 * Bringing in records from a CSV.
 *
 * The file never reaches the server: the screen reads it on the device and
 * sends only the rows the person has looked at. What the page loads here is
 * what the preview needs to decide with: the open accounts and the
 * categories a row may be filed under. The guesses are asked for once a
 * file is chosen.
 */
export default async function ImportPage() {
  const supabase = await createClient();

  const [accounts, categories] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name")
      .eq("archived", false)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    getActiveCategories(),
  ]);

  if (accounts.error) throw new Error(accounts.error.message);

  return (
    <PageShell>
      <PageHeader title="Import" description="Bring in records from a CSV" />

      <ImportScreen
        accounts={accounts.data}
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          kind: category.kind,
          icon: category.icon,
          tint: category.tint,
        }))}
      />
    </PageShell>
  );
}
