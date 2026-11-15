import type { Metadata } from "next";

import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New password" };

export default async function ResetPasswordPage() {
  // The recovery link signs the user in on its way through /auth/callback.
  // No session here means the link expired, was already used, or someone
  // wandered in directly.
  const user = await getCurrentUser();

  if (!user) {
    return (
      <AuthCard
        title="That link has expired"
        description="Reset links work once and last an hour. Ask for a fresh one and you will be back in a minute."
        footer={
          <Link
            href="/login"
            className="text-text font-semibold underline underline-offset-4"
          >
            Back to sign in
          </Link>
        }
      >
        <Button asChild size="touch" className="w-full">
          <Link href="/forgot-password">Send a new link</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      description={`Signed in as ${user.email}. Pick something you have not used here before.`}
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
