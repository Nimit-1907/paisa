import type { Metadata } from "next";

import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <AuthCard
      title="Start tracking"
      description="Expenses, income and budgets in one place. Free, and yours alone."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-foreground font-medium underline underline-offset-4"
          >
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
