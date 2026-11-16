"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { signIn } from "@/actions/auth";
import {
  rememberEmail,
  rememberedEmail,
} from "@/components/auth/remembered-email";
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
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "", next },
  });

  /**
   * Fill in the address this browser used last.
   *
   * In an effect rather than as a default value: `localStorage` does not
   * exist while this renders on the server, and seeding the form from it
   * during the first client render would be a hydration mismatch. The cost
   * is one frame with an empty field, which nobody can act on anyway.
   *
   * Focus goes to the password when there is an email to come back to,
   * which is the field that person was going to fill in either way.
   */
  React.useEffect(() => {
    const remembered = rememberedEmail();
    if (!remembered) return;

    setValue("email", remembered);
    setFocus("password");
  }, [setFocus, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    const result = await signIn({ ...values, next });

    if (!result.ok) {
      if (result.field === "email" || result.field === "password") {
        setError(result.field, { message: result.error });
      }
      toast.error(result.error);
      return;
    }

    rememberEmail(values.email);

    // router.refresh() so the layouts above re-read the new session cookie
    // before the records page renders against it.
    router.replace(result.data.next);
    router.refresh();
  });

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

      <FormRow
        id="password"
        label="Password"
        required
        error={errors.password?.message}
        action={
          <Link
            href="/forgot-password"
            className="text-text-secondary hoverable:text-text -my-2 rounded px-1 py-2 text-sm"
          >
            Forgot password?
          </Link>
        }
      >
        {(field) => (
          <PasswordInput
            {...field}
            {...register("password")}
            autoComplete="current-password"
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
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}
