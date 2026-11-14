"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth-guard";
import {
  type ActionResult,
  fail,
  failFromDb,
  ok,
  parseInput,
} from "@/lib/action-result";
import {
  type CategoryFormInput,
  type UpdateCategoryInput,
  categoryIdSchema,
  createCategorySchema,
  updateCategorySchema,
} from "@/lib/schemas/categories";
import { reorderSchema } from "@/lib/schemas/accounts";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const archiveCategorySchema = z.object({
  id: z.string().uuid(),
  archived: z.boolean(),
});


/** The kind a category actually has, for an accurate duplicate message. */
async function storedKind(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
): Promise<string> {
  const { data } = await supabase
    .from("categories")
    .select("kind")
    .eq("id", id)
    .maybeSingle();

  return data?.kind ?? "expense";
}

function revalidateCategories() {
  revalidatePath("/categories");
  revalidatePath("/records");
  revalidatePath("/analysis");
  revalidatePath("/budgets");
}

/**
 * The unique index on (user_id, kind, lower(name)) is the real guard; this
 * turns its 23505 into something a person would say.
 */
function duplicateMessage(name: string, kind: string): string {
  return `You already have ${kind === "income" ? "an income" : "an expense"} category called "${name}".`;
}

const isDuplicate = (message: string) =>
  message.includes("categories_user_kind_name_key") ||
  message.toLowerCase().includes("duplicate key");

export async function createCategory(
  input: CategoryFormInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = parseInput(createCategorySchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();

  const user = await requireUser(supabase);
  if (!user.ok) return user;

  const { data: last } = await supabase
    .from("categories")
    .select("sort_order")
    .eq("user_id", user.id)
    .eq("kind", parsed.data.kind)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("categories")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      kind: parsed.data.kind,
      icon: parsed.data.icon,
      color: parsed.data.color,
      sort_order: (last?.sort_order ?? -1) + 1,
    })
    .select("id")
    .single();

  if (error) {
    if (isDuplicate(error.message)) {
      return fail(duplicateMessage(parsed.data.name, parsed.data.kind), "name");
    }
    return failFromDb(error, "Could not add the category.");
  }

  revalidateCategories();
  return ok({ id: data.id });
}

export async function updateCategory(
  input: UpdateCategoryInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = parseInput(updateCategorySchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();

  const user = await requireUser(supabase);
  if (!user.ok) return user;

  const { data, error } = await supabase
    .from("categories")
    .update({
      name: parsed.data.name,
      icon: parsed.data.icon,
      color: parsed.data.color,
    })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select("id, kind")
    .maybeSingle();

  if (error) {
    if (isDuplicate(error.message)) {
      // The kind comes from the stored row, never from the request: a
      // category cannot change kind, and a wrong one in the payload would
      // otherwise produce a message naming the wrong tab.
      const kind = await storedKind(supabase, parsed.data.id);
      return fail(duplicateMessage(parsed.data.name, kind), "name");
    }
    return failFromDb(error, "Could not save the category.");
  }

  if (!data) return fail("That category no longer exists.");

  revalidateCategories();
  return ok({ id: parsed.data.id });
}

export async function setCategoryArchived(
  input: { id: string; archived: boolean },
): Promise<ActionResult<{ archived: boolean }>> {
  const parsed = parseInput(archiveCategorySchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();

  const user = await requireUser(supabase);
  if (!user.ok) return user;

  const { data, error } = await supabase
    .from("categories")
    .update({ archived: parsed.data.archived })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return failFromDb(
      error,
      parsed.data.archived
        ? "Could not archive the category."
        : "Could not restore the category.",
    );
  }

  if (!data) return fail("That category no longer exists.");

  revalidateCategories();
  return ok({ archived: parsed.data.archived });
}

export async function deleteCategory(
  input: { id: string },
): Promise<ActionResult<undefined>> {
  const parsed = parseInput(categoryIdSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();

  const user = await requireUser(supabase);
  if (!user.ok) return user;

  // Re-checked here, not just in the UI: a budget created on another device
  // between page load and this click would otherwise surface as a foreign key
  // error at commit time.
  const { data: usage, error: usageError } = await supabase
    .from("category_usage")
    .select("transaction_count, budget_count, recurring_rule_count")
    .eq("category_id", parsed.data.id)
    .maybeSingle();

  if (usageError) {
    return failFromDb(usageError, "Could not check the category.");
  }

  const inUse =
    (usage?.transaction_count ?? 0) > 0 ||
    (usage?.budget_count ?? 0) > 0 ||
    (usage?.recurring_rule_count ?? 0) > 0;

  if (inUse) {
    return fail(
      "This category is still in use. Archive it instead to keep your records intact.",
    );
  }

  const { data, error } = await supabase
    .from("categories")
    .delete()
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    // Something could have started using it between the check and here.
    if (error.code === "23503") {
      return fail(
        "This category is still in use. Archive it instead to keep your records intact.",
      );
    }
    return failFromDb(error, "Could not delete the category.");
  }

  if (!data) return fail("That category no longer exists.");

  revalidateCategories();
  return ok(undefined);
}

export async function reorderCategories(
  input: { ids: string[] },
): Promise<ActionResult<undefined>> {
  const parsed = parseInput(reorderSchema, input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();

  // One statement in one transaction: an update per id costs a round trip
  // each and can leave the order half-applied when one of them fails. Ids
  // that are not the caller's match nothing, so the RPC needs no extra guard.
  const { error } = await supabase.rpc("reorder_categories", {
    p_ids: parsed.data.ids,
  });

  if (error) return failFromDb(error, "Could not save the new order.");

  revalidateCategories();
  return ok(undefined);
}
