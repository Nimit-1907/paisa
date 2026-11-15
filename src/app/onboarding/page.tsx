import type { Metadata } from "next";

import { redirect } from "next/navigation";

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { getProfile, needsOnboarding } from "@/lib/profile";
import { HOME_PATH, LOGIN_PATH } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Set up Paisa" };

export default async function OnboardingPage() {
  const profile = await getProfile();

  if (!profile) {
    redirect(LOGIN_PATH);
  }

  // Shown once: anyone who has already been through it goes straight in.
  if (!needsOnboarding(profile)) {
    redirect(HOME_PATH);
  }

  const supabase = await createClient();
  const { data: account } = await supabase
    .from("accounts")
    .select("name")
    .eq("user_id", profile.id)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const suggestedName =
    (user?.user_metadata?.display_name as string | undefined)?.trim() ?? "";

  // A full-height column rather than a centred block: the Continue button
  // lives in a sticky bottom bar, and a bar can only stick to the bottom of
  // something that reaches it. The step itself is still centred in the space
  // left over.
  return (
    <main className="pt-safe flex min-h-dvh flex-col items-center px-4 pt-10">
      <OnboardingFlow
        initialName={suggestedName}
        initialAccountName={account?.name ?? "Cash"}
      />
    </main>
  );
}
