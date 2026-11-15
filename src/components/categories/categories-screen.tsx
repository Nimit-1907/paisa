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
import { Amount } from "@/components/shared/amount";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { DragHandle, SortableList } from "@/components/shared/sortable-list";
import { Button } from "@/components/ui/button";
import { CATEGORY_KINDS, type CategoryKind } from "@/lib/schemas/categories";
import { cn } from "@/lib/utils";
import { Tile } from "@/components/shared/tile";

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
      <SegmentedControl
        label="Category kind"
        value={kind}
        onChange={(next) => {
          setKind(next);
          setReordering(false);
        }}
        options={CATEGORY_KINDS.map((value) => ({
          value,
          label: KIND_LABELS[value],
        }))}
      />

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
          <SectionHeader
            className="px-1"
            // Not "Expense 13": the segmented control directly above
            // already says which kind is showing, and a heading that
            // repeats the control under it is a line of nothing.
            title={`${active.length} ${
              active.length === 1 ? "category" : "categories"
            }`}
            trailing={
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
            }
          />

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
              className="bg-surface divide-hairline divide-y overflow-hidden rounded-card border"
              renderItem={(category, { handleProps, isDragging }) => (
                <div
                  className={cn(
                    "bg-surface flex min-h-14 items-center gap-2 pr-3 pl-1",
                    isDragging && "bg-surface-muted",
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
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-6">
              {active.map((category) => {
                const total =
                  category.monthTotal === null
                    ? null
                    : BigInt(category.monthTotal);
                return (
                  <li key={category.id}>
                    <button
                      type="button"
                      onClick={() => openEdit(category)}
                      className="bg-surface hoverable:bg-surface-muted rounded-card pressable flex w-full flex-col items-center gap-1.5 border px-1 py-3 transition-colors"
                    >
                      <CategoryBadge category={category} size="lg" />
                      <span className="w-full truncate text-center text-[11px] font-semibold">
                        {category.name}
                      </span>
                      {/* This month, under the name. A grid of names answers
                          "what are my categories", which is not the question
                          anybody opens this screen with.

                          Nothing at all when the totals could not be read:
                          a dash there would say "you spent nothing", which
                          a failed query has not earned. */}
                      {total === null ? null : (
                        <span className="text-text-secondary w-full truncate text-center text-[11px]">
                          {total > 0n ? (
                            <Amount value={total} signDisplay="never" whole />
                          ) : (
                            "—"
                          )}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}

              <li>
                <button
                  type="button"
                  onClick={openAdd}
                  className="border-hairline text-text-secondary hoverable:border-hairline hoverable:text-text flex h-full min-h-[92px] w-full flex-col items-center justify-center gap-2 rounded-control border border-dashed px-2 py-3 transition-colors  "
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
            className="text-text-secondary hoverable:text-text flex min-h-11 w-full items-center gap-1.5 rounded-lg px-1 text-sm font-semibold  "
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
              <p className="text-text-secondary mb-2 px-1 text-xs">
                Still shown on the records that use them, but not offered when
                you add something new.
              </p>
              <ul className="grid grid-cols-3 gap-2 opacity-70 sm:grid-cols-4 lg:grid-cols-5">
                {archived.map((category) => (
                  <li key={category.id}>
                    <button
                      type="button"
                      onClick={() => openEdit(category)}
                      className="bg-surface hoverable:bg-surface-muted flex w-full flex-col items-center gap-2 rounded-card border border-dashed px-2 py-3 transition-colors  "
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
    <Tile
      tint={category.tint}
      icon={category.icon}
      size={size === "lg" ? "lg" : "md"}
    />
  );
}
