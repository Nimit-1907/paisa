import { z } from "zod";

import { isColor } from "@/lib/colors";
import { ICON_NAMES } from "@/lib/icons";

export const CATEGORY_KINDS = ["expense", "income"] as const;

export const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the category a name.")
    .max(60, "That name is a bit long."),
  kind: z.enum(CATEGORY_KINDS),
  icon: z
    .string()
    .refine((value) => (ICON_NAMES as string[]).includes(value), "Pick an icon."),
  color: z.string().refine(isColor, "Pick a colour."),
});

export const createCategorySchema = categoryFormSchema;

// No `kind`: a category never changes kind, and taking it from the client
// means an error message could name the wrong one.
export const updateCategorySchema = categoryFormSchema
  .omit({ kind: true })
  .extend({ id: z.string().uuid() });

export const categoryIdSchema = z.object({ id: z.string().uuid() });

export type CategoryFormInput = z.input<typeof categoryFormSchema>;
export type UpdateCategoryInput = z.input<typeof updateCategorySchema>;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];
