"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { signUp } from "@/actions/auth";
import { CheckEmailNotice } from "@/components/auth/check-email-notice";
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
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: "", email: "", password: "" },
  });

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
      <CheckEmailNotice>
        We sent a confirmation link to{" "}
        <span className="text-foreground font-medium">{sentTo}</span>. Open it
        to finish setting up your account.
      </CheckEmailNotice>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormRow
        id="displayName"
        label="Your name"
        error={errors.displayName?.message}
        hint="Optional — you can add it during setup."
      >
        {(field) => (
          <Input
            {...field}
            {...register("displayName")}
            autoComplete="name"
            placeholder="Nimit"
          />
        )}
      </FormRow>

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

      <FormRow
        id="password"
        label="Password"
        error={errors.password?.message}
        hint="At least 8 characters."
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
