"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { updatePassword } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { FormRow, PasswordInput } from "@/components/ui/form-row";
import {
  type UpdatePasswordInput,
  updatePasswordSchema,
} from "@/lib/schemas/auth";

export function ResetPasswordForm() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePasswordInput>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    const result = await updatePassword(values);

    if (!result.ok) {
      if (result.field === "password" || result.field === "confirmPassword") {
        setError(result.field, { message: result.error });
      }
      toast.error(result.error);
      return;
    }

    toast.success("Password updated");
    router.replace(result.data.next);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormRow
        id="password"
        label="New password"
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

      <FormRow
        id="confirmPassword"
        label="Confirm password"
        error={errors.confirmPassword?.message}
      >
        {(field) => (
          <PasswordInput
            {...field}
            {...register("confirmPassword")}
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
            Saving…
          </>
        ) : (
          "Save new password"
        )}
      </Button>
    </form>
  );
}
