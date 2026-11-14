import type { Metadata } from "next";

import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthErrorToast } from "@/components/auth/auth-error-toast";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to pick up where your money left off."
      footer={
        <>
          New here?{" "}
          <Link
            href="/signup"
            className="text-foreground font-medium underline underline-offset-4"
          >
            Create an account
          </Link>
        </>
      }
    >
      <AuthErrorToast message={error} />
      <LoginForm next={next} />
    </AuthCard>
  );
}
