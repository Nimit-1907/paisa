"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import {
  ChevronDown,
  ChevronRight,
  Check,
  GripVertical,
  Plus,
  Tags,
} from "lucide-react";
import { toast } from "sonner";

import { reorderCategories } from "@/actions/categories";
import { CategoryFormSheet } from "@/components/categories/category-form-sheet";
import type { CategoryView } from "@/components/categories/types";
import { EmptyState } from "@/components/shared/empty-state";
import { DragHandle, SortableList } from "@/components/shared/sortable-list";
import { Button } from "@/components/ui/button";
import { CATEGORY_KINDS, type CategoryKind } from "@/lib/schemas/categories";
import { cn } from "@/lib/utils";
import { ColorDot } from "@/components/shared/color-dot";

const KIND_LABELS: Record<CategoryKind, string> = {
  expense: "Expense",
  income: "Income",
};

/**
 * The Categories screen.
 *
 * A grid to browse, a list to reorder. Dragging tiles around a wrapping grid
 * is fiddly with a thumb and impossible with a keyboard, so "Reorder" swaps
 * in a single-column list with handles and arrow-key support, then swaps back.
 */
export function CategoriesScreen({
  categories,
}: {
  categories: CategoryView[];
}) {
  const router = useRouter();
  const [kind, setKind] = React.useState<CategoryKind>("expense");
  const [reordering, setReordering] = React.useState(false);
  const [showArchived, setShowArchived] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CategoryView | undefined>();

  const ofKind = categories.filter((category) => category.kind === kind);
  const active = ofKind.filter((category) => !category.archived);
  const archived = ofKind.filter((category) => category.archived);

  function openAdd() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(category: CategoryView) {
    setEditing(category);
    setFormOpen(true);
  }

  async function handleReorder(ids: string[]) {
    // Only this kind's ids are sent, so the RPC renumbers only these rows and
    // the other tab keeps the sort_order it had. Numbers may repeat across
    // kinds, which is harmless: every list is filtered by kind first.
    const result = await reorderCategories({
      ids: [...ids, ...archived.map((category) => category.id)],
    });

    // Thrown rather than toasted: SortableList reports it through
    // onReorderError, so both failure paths end in one place.
    if (!result.ok) throw new Error(result.error);

    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Category kind"
        className="bg-muted grid grid-cols-2 gap-1 rounded-control p-1"
      >
        {CATEGORY_KINDS.map((value) => {
          const selected = value === kind;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setKind(value);
                setReordering(false);
              }}
              className={cn(
                "focus-visible:ring-ring h-11 rounded-lg text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none",
                selected
                  ? value === "income"
                    ? "bg-income-soft text-income shadow-sm"
                    : "bg-expense-soft text-expense shadow-sm"
                  : "text-ink-2 hoverable:text-foreground",
              )}
            >
              {KIND_LABELS[value]}
            </button>
          );
        })}
      </div>

      {active.length === 0 ? (
        <EmptyState
          icon={Tags}
          title={`No ${KIND_LABELS[kind].toLowerCase()} categories`}
          description="Categories are how the analysis screen groups your spending. Add the ones you actually use."
          action={
            <Button size="touch" onClick={openAdd}>
              <Plus className="size-4" aria-hidden="true" />
              Add category
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-ink-2 px-1 text-xs font-semibold tracking-wider uppercase">
              {active.length} {active.length === 1 ? "category" : "categories"}
            </p>

            <Button
              variant={reordering ? "default" : "ghost"}
              size="touch"
              className="px-3"
              onClick={() => setReordering((on) => !on)}
            >
              {reordering ? (
                <>
                  <Check className="size-4" aria-hidden="true" />
                  Done
                </>
              ) : (
                <>
                  <GripVertical className="size-4" aria-hidden="true" />
                  Reorder
                </>
              )}
            </Button>
          </div>

          {reordering ? (
            <SortableList
              items={active}
              getId={(category) => category.id}
              onReorder={(ids) => handleReorder(ids)}
              onReorderError={(error) => {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Could not save the new order.",
                );
                router.refresh();
              }}
              className="bg-card divide-border divide-y overflow-hidden rounded-card border"
              renderItem={(category, { handleProps, isDragging }) => (
                <div
                  className={cn(
                    "bg-card flex min-h-14 items-center gap-2 pr-3 pl-1",
                    isDragging && "bg-muted",
                  )}
                >
                  <DragHandle {...handleProps} />
                  <CategoryBadge category={category} />
                  <span className="truncate text-sm font-semibold">
                    {category.name}
                  </span>
                </div>
              )}
            />
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
              {active.map((category) => (
                <li key={category.id}>
                  <button
                    type="button"
                    onClick={() => openEdit(category)}
                    className="bg-card hoverable:bg-muted/50 focus-visible:ring-ring flex w-full flex-col items-center gap-2 rounded-card border px-2 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <CategoryBadge category={category} size="lg" />
                    <span className="w-full truncate text-center text-xs font-semibold">
                      {category.name}
                    </span>
                  </button>
                </li>
              ))}

              <li>
                <button
                  type="button"
                  onClick={openAdd}
                  className="border-border/70 text-ink-2 hoverable:border-border hoverable:text-foreground focus-visible:ring-ring flex h-full min-h-[92px] w-full flex-col items-center justify-center gap-2 rounded-control border border-dashed px-2 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <Plus className="size-5" aria-hidden="true" />
                  <span className="text-xs font-semibold">Add</span>
                </button>
              </li>
            </ul>
          )}
        </>
      )}

      {archived.length > 0 ? (
        <section aria-label="Archived categories">
          <button
            type="button"
            onClick={() => setShowArchived((open) => !open)}
            aria-expanded={showArchived}
            className="text-ink-2 hoverable:text-foreground focus-visible:ring-ring flex min-h-11 w-full items-center gap-1.5 rounded-lg px-1 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            {showArchived ? (
              <ChevronDown className="size-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-4" aria-hidden="true" />
            )}
            Archived ({archived.length})
          </button>

          {showArchived ? (
            <>
              <p className="text-ink-2 mb-2 px-1 text-xs">
                Still shown on the records that use them, but not offered when
                you add something new.
              </p>
              <ul className="grid grid-cols-3 gap-2 opacity-70 sm:grid-cols-4 lg:grid-cols-5">
                {archived.map((category) => (
                  <li key={category.id}>
                    <button
                      type="button"
                      onClick={() => openEdit(category)}
                      className="bg-card hoverable:bg-muted/50 focus-visible:ring-ring flex w-full flex-col items-center gap-2 rounded-card border border-dashed px-2 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <CategoryBadge category={category} size="lg" />
                      <span className="w-full truncate text-center text-xs font-semibold">
                        {category.name}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}

      <CategoryFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        kind={kind}
        category={editing}
      />
    </div>
  );
}

function CategoryBadge({
  category,
  size = "sm",
}: {
  category: CategoryView;
  size?: "sm" | "lg";
}) {
  return (
    <ColorDot
      color={category.color}
      icon={category.icon}
      size={size === "lg" ? "lg" : "md"}
    />
  );
}
