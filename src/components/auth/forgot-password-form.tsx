"use client";

import * as React from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { requestPasswordReset } from "@/actions/auth";
import { CheckEmailNotice } from "@/components/auth/check-email-notice";
import { Button } from "@/components/ui/button";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import {
  type ResetRequestInput,
  resetRequestSchema,
} from "@/lib/schemas/auth";

export function ForgotPasswordForm() {
  const [sent, setSent] = React.useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetRequestInput>({
    resolver: zodResolver(resetRequestSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    const result = await requestPasswordReset(values);

    if (!result.ok) {
      if (result.field === "email") {
        setError("email", { message: result.error });
      }
      toast.error(result.error);
      return;
    }

    setSent(true);
  });

  if (sent) {
    return (
      <CheckEmailNotice>
        If that address is registered, a reset link is on its way. The link
        works once and expires in an hour.
      </CheckEmailNotice>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
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

      <Button
        type="submit"
        size="touch"
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Sending…
          </>
        ) : (
          "Send reset link"
        )}
      </Button>
    </form>
  );
}
