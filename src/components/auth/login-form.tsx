"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { signIn } from "@/actions/auth";
import { FormRow, PasswordInput } from "@/components/ui/form-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type SignInInput, signInSchema } from "@/lib/schemas/auth";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "", next },
  });

  const onSubmit = handleSubmit(async (values) => {
    const result = await signIn({ ...values, next });

    if (!result.ok) {
      if (result.field === "email" || result.field === "password") {
        setError(result.field, { message: result.error });
      }
      toast.error(result.error);
      return;
    }

    // router.refresh() so the layouts above re-read the new session cookie
    // before the records page renders against it.
    router.replace(result.data.next);
    router.refresh();
  });

  return (
    <form
      // Before React hydrates, a submit falls back to the browser, which
      // defaults to GET — and a GET puts the password in the URL, where it
      // lands in history and in the server log.
      method="post"
      onSubmit={onSubmit}
      className="space-y-4"
      noValidate
    >
      <FormRow id="email" label="Email" error={errors.email?.message}>
        {(field) => (
          <Input
            {...field}
            {...register("email")}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="you@example.com"
          />
        )}
      </FormRow>

      <FormRow id="password" label="Password" error={errors.password?.message}>
        {(field) => (
          <PasswordInput
            {...field}
            {...register("password")}
            autoComplete="current-password"
            placeholder="••••••••"
          />
        )}
      </FormRow>

      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-muted-foreground hoverable:text-foreground focus-visible:ring-ring -my-2 rounded px-1 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
        >
          Forgot password?
        </Link>
      </div>

      <Button
        type="submit"
        size="touch"
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}
