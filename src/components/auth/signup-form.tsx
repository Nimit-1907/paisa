"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { resendConfirmation, signUp } from "@/actions/auth";
import { CheckEmailNotice } from "@/components/auth/check-email-notice";
import { PasswordHints } from "@/components/auth/password-hints";
import { Button } from "@/components/ui/button";
import { FormRow, PasswordInput } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { type SignUpInput, signUpSchema } from "@/lib/schemas/auth";

export function SignupForm() {
  const router = useRouter();
  const [sentTo, setSentTo] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: "", email: "", password: "" },
  });

  const password = watch("password") ?? "";

  const onSubmit = handleSubmit(async (values) => {
    const result = await signUp(values);

    if (!result.ok) {
      if (
        result.field === "email" ||
        result.field === "password" ||
        result.field === "displayName"
      ) {
        setError(result.field, { message: result.error });
      }
      toast.error(result.error);
      return;
    }

    if (result.data.needsEmailConfirmation) {
      setSentTo(result.data.email);
      return;
    }

    // Confirmations switched off (or already confirmed): straight in.
    toast.success("Welcome to Paisa");
    router.replace("/onboarding");
    router.refresh();
  });

  if (sentTo) {
    return (
      <CheckEmailNotice
        email={sentTo}
        onResend={() => resendConfirmation({ email: sentTo })}
      >
        Open the confirmation link to finish setting up your account.
      </CheckEmailNotice>
    );
  }

  return (
    <form
      // Before React hydrates, a submit falls back to the browser, which
      // defaults to GET, and a GET puts the password in the URL, where it
      // lands in history and in the server log.
      method="post"
      onSubmit={onSubmit}
      className="space-y-4"
      noValidate
    >
      <FormRow
        id="displayName"
        label="Your name"
        error={errors.displayName?.message}
        hint="You can add this later in Settings."
      >
        {(field) => (
          <Input
            {...field}
            {...register("displayName")}
            autoComplete="name"
            placeholder="Aarav"
          />
        )}
      </FormRow>

      <FormRow id="email" label="Email" error={errors.email?.message} required>
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

      <div>
        <FormRow
          id="password"
          label="Password"
          error={errors.password?.message}

          required
        >
          {(field) => (
            <PasswordInput
              {...field}
              {...register("password")}
              autoComplete="new-password"
              placeholder="••••••••"
            />
          )}
        </FormRow>

        {/* The checklist replaces the old static "At least 8 characters"
            hint: same rule, but it ticks itself off as you type. */}
        <PasswordHints value={password} />
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
            Creating account…
          </>
        ) : (
          "Create account"
        )}
      </Button>
    </form>
  );
}
