"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Archive, ArchiveRestore, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createCategory,
  deleteCategory,
  setCategoryArchived,
  updateCategory,
} from "@/actions/categories";
import type { CategoryView } from "@/components/categories/types";
import { ColorPicker } from "@/components/shared/color-picker";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { IconPicker } from "@/components/shared/icon-picker";
import {
  ResponsiveSheet,
  SheetBody,
  SheetFooter,
} from "@/components/shared/responsive-sheet";
import { Button } from "@/components/ui/button";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_COLOR, colorForName } from "@/lib/colors";
import { DEFAULT_CATEGORY_ICON } from "@/lib/icons";
import type { CategoryKind } from "@/lib/schemas/categories";

/**
 * Add or edit a category.
 *
 * Archive and delete live in here rather than behind a per-tile menu: a grid
 * of 40px tiles has nowhere sensible to put a menu, and both actions want the
 * context this sheet already shows.
 */
export function CategoryFormSheet({
  open,
  onOpenChange,
  kind,
  category,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which tab is open — the kind a new category is created in. */
  kind: CategoryKind;
  category?: CategoryView;
}) {
  const router = useRouter();

  const [name, setName] = React.useState("");
  const [icon, setIcon] = React.useState<string>(DEFAULT_CATEGORY_ICON);
  const [color, setColor] = React.useState(DEFAULT_COLOR);
  const [error, setError] = React.useState<string | null>(null);
  const [field, setField] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;

    setName(category?.name ?? "");
    setIcon(category?.icon ?? DEFAULT_CATEGORY_ICON);
    setColor(category?.color ?? DEFAULT_COLOR);
    setError(null);
    setField(null);
  }, [open, category]);

  const canDelete = (category?.usageCount ?? 0) === 0;

  async function run<T>(
    work: () => Promise<
      { ok: true; data: T } | { ok: false; error: string; field?: string }
    >,
    success: string,
  ) {
    setSaving(true);
    setError(null);
    setField(null);

    try {
      const result = await work();

      if (!result.ok) {
        setError(result.error);
        setField(result.field ?? null);
        toast.error(result.error);
        return false;
      }

      toast.success(success);
      onOpenChange(false);
      // revalidatePath marks the cache; this re-renders the open page with it.
      router.refresh();
      return true;
    } catch (thrown) {
      // Logged, not swallowed: a server-side fault and a dropped connection
      // look the same from here, and only one of them leaves a trace to
      // debug from if this is dropped on the floor.
      console.error("[categories]", thrown);

      const message = "Could not save. Check your connection and try again.";
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ResponsiveSheet
        open={open}
        onOpenChange={onOpenChange}
        title={category ? "Edit category" : "New category"}
        description={
          category
            ? undefined
            : `A new ${kind === "income" ? "income" : "expense"} category.`
        }
      >
        <SheetBody>
          <div className="flex items-center gap-3">
            <span
              className="flex size-12 shrink-0 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: color }}
            >
              <DynamicIcon name={icon} className="size-6" />
            </span>

            <div className="min-w-0 flex-1">
              <FormRow
                id="category-name"
                label="Name"
                error={field === "name" ? (error ?? undefined) : undefined}
              >
                {(props) => (
                  <Input
                    {...props}
                    value={name}
                    onChange={(event) => {
                      const next = event.target.value;
                      setName(next);
                      // Give a new category a colour that looks chosen rather
                      // than default, until the user picks one.
                      if (!category && color === DEFAULT_COLOR && next.trim()) {
                        setColor(colorForName(next));
                      }
                    }}
                    placeholder={kind === "income" ? "Freelance" : "Groceries"}
                    // eslint-disable-next-line jsx-a11y/no-autofocus -- the sheet has just been opened; this is the field it was opened for.
                    autoFocus={!category}
                  />
                )}
              </FormRow>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Colour</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          <div className="space-y-1.5">
            <Label>Icon</Label>
            <IconPicker value={icon} onChange={setIcon} color={color} />
          </div>

          {error && !field ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}

          {category ? (
            <div className="space-y-2 border-t pt-4">
              <Button
                variant="outline"
                size="touch"
                className="w-full"
                disabled={saving}
                onClick={() =>
                  void run(
                    () =>
                      setCategoryArchived({
                        id: category.id,
                        archived: !category.archived,
                      }),
                    category.archived
                      ? "Category restored"
                      : `${category.name} archived`,
                  )
                }
              >
                {category.archived ? (
                  <>
                    <ArchiveRestore className="size-4" aria-hidden="true" />
                    Restore category
                  </>
                ) : (
                  <>
                    <Archive className="size-4" aria-hidden="true" />
                    Archive category
                  </>
                )}
              </Button>

              <Button
                variant="destructive"
                size="touch"
                className="w-full"
                disabled={saving || !canDelete}
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Delete category
              </Button>

              {!canDelete ? (
                <p className="text-muted-foreground text-center text-xs">
                  {category.transactionCount > 0
                    ? `Used by ${category.transactionCount} ${
                        category.transactionCount === 1 ? "record" : "records"
                      } — archive it instead to keep them.`
                    : "Used by a budget or a recurring rule — archive it instead."}
                </p>
              ) : null}
            </div>
          ) : null}
        </SheetBody>

        <SheetFooter>
          <Button
            variant="outline"
            size="touch"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            size="touch"
            className="flex-1"
            disabled={saving || name.trim().length === 0}
            onClick={() =>
              void run(
                () =>
                  category
                    ? updateCategory({ id: category.id, name, icon, color })
                    : createCategory({ kind, name, icon, color }),
                category ? "Category updated" : "Category added",
              )
            }
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : category ? (
              "Save changes"
            ) : (
              "Add category"
            )}
          </Button>
        </SheetFooter>
      </ResponsiveSheet>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Delete ${category?.name}?`}
        description="Nothing uses this category, so nothing else will change. It cannot be undone."
        pending={saving}
        onConfirm={() => {
          if (!category) return;
          setConfirmingDelete(false);
          void run(() => deleteCategory({ id: category.id }), "Category deleted");
        }}
      />
    </>
  );
}
