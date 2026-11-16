import type { Metadata } from "next";

import { ShareLanding } from "@/components/records/share-landing";

export const metadata: Metadata = {
  title: "Shared payment",
  robots: { index: false, follow: false },
};

/**
 * Where the phone's share sheet lands: the shared title and text, handed
 * to the screen that opens Add Record with them.
 */
export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // A key can arrive twice (?text=a&text=b), as an array: every part
  // counts. Apps put the payment line in either field, some in both.
  const shared = ["title", "text", "url"]
    .flatMap((key) => params[key] ?? [])
    .filter((part) => part.trim() !== "")
    .join(" ")
    .slice(0, 2000);

  return <ShareLanding text={shared} />;
}
