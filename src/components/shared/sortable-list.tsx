"use client";

import * as React from "react";

import { GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A reorderable list that works with a thumb.
 *
 * Built on Pointer Events rather than HTML5 drag-and-drop, which does not fire
 * on touch at all, and without a drag-and-drop library, which would mean
 * adding a dependency CLAUDE.md does not list. `touch-action: none` on the
 * handle is what stops the page from scrolling mid-drag.
 *
 * The handle is also a keyboard control: arrow keys move an item one slot, so
 * reordering does not require a pointer at all.
 */
export type SortableRenderProps = {
  isDragging: boolean;
  /** Spread onto whatever should start a drag. */
  handleProps: React.HTMLAttributes<HTMLElement>;
};

export function SortableList<T>({
  items,
  getId,
  onReorder,
  onReorderError,
  renderItem,
  disabled = false,
  className,
  itemClassName,
}: {
  items: T[];
  getId: (item: T) => string;
  /**
   * Called with the full list of ids in their new order. If it returns a
   * promise, the optimistic order is dropped once that settles, so a reorder
   * the server rejects snaps back to what the server actually has.
   */
  onReorder: (ids: string[]) => void | Promise<unknown>;
  /** Called when onReorder rejects, so the screen can say so. */
  onReorderError?: (error: unknown) => void;
  renderItem: (item: T, props: SortableRenderProps) => React.ReactNode;
  disabled?: boolean;
  className?: string;
  itemClassName?: string;
}) {
  // Only the *order* is local state, never the items themselves. Holding
  // copies would keep showing a stale name, colour or balance after an edit
  // that did not change the sequence.
  const [orderIds, setOrderIds] = React.useState<string[] | null>(null);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [offset, setOffset] = React.useState(0);

  const rowRefs = React.useRef(new Map<string, HTMLElement | null>());
  const drag = React.useRef<{
    startY: number;
    index: number;
    /** The dragged row's centre with no transform applied. */
    centre: number;
    height: number;
  } | null>(null);

  const order = React.useMemo(() => {
    if (!orderIds) return items;

    const byId = new Map(items.map((item) => [getId(item), item]));
    const known = orderIds
      .map((id) => byId.get(id))
      .filter((item): item is T => item !== undefined);
    const added = items.filter((item) => !orderIds.includes(getId(item)));

    return [...known, ...added];
  }, [items, orderIds, getId]);

  /**
   * Sends the new order, then hands control back to the server's copy.
   *
   * A rejected or throwing onReorder must not become an unhandled rejection
   * that leaves the list stuck on an order the server never accepted: it is
   * reported through onReorderError and the optimistic order is dropped
   * either way.
   */
  const settle = React.useCallback(
    async (ids: string[]) => {
      try {
        await onReorder(ids);
      } catch (error) {
        onReorderError?.(error);
      } finally {
        setOrderIds(null);
      }
    },
    [onReorder, onReorderError],
  );

  function move(from: number, to: number) {
    // Guarded here as well as in onPointerDown: a disabled handle can still
    // be focused and keyed.
    if (disabled) return;
    if (to < 0 || to >= order.length || from === to) return;

    const next = order.map(getId);
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    setOrderIds(next);
    void settle(next);
  }

  function onPointerDown(
    event: React.PointerEvent<HTMLElement>,
    index: number,
  ) {
    if (disabled || event.button !== 0) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const rect = rowRefs.current
      .get(getId(order[index]))
      ?.getBoundingClientRect();

    drag.current = {
      startY: event.clientY,
      index,
      // Measured now, while the row still has no transform on it.
      centre: rect ? rect.top + rect.height / 2 : event.clientY,
      height: rect?.height ?? 0,
    };
    setDraggingId(getId(order[index]));
    setOffset(0);
  }

  function onPointerMove(event: React.PointerEvent<HTMLElement>) {
    const state = drag.current;
    if (!state) return;

    const delta = event.clientY - state.startY;
    setOffset(delta);

    // The dragged row's centre, from the position recorded at pointerdown.
    // Reading its rect here instead would include the transform above and
    // count the travel twice.
    const centre = state.centre + delta;

    const direction = delta > 0 ? 1 : -1;
    const neighbourIndex = state.index + direction;
    if (neighbourIndex < 0 || neighbourIndex >= order.length) return;

    const neighbour = rowRefs.current.get(getId(order[neighbourIndex]));
    if (!neighbour) return;

    const neighbourRect = neighbour.getBoundingClientRect();
    const neighbourCentre = neighbourRect.top + neighbourRect.height / 2;

    // The leading edge, not the centre: a row should take the slot below it
    // once it covers half of it, which is half a row of travel rather than a
    // whole one.
    const leadingEdge = centre + (direction * state.height) / 2;

    const passed =
      direction > 0
        ? leadingEdge > neighbourCentre
        : leadingEdge < neighbourCentre;

    if (!passed) return;

    const next = order.map(getId);
    const [moved] = next.splice(state.index, 1);
    next.splice(neighbourIndex, 0, moved);
    setOrderIds(next);

    // The rows have swapped places, so move the origin and the recorded
    // centre by one row to keep the dragged row under the finger.
    const shift = direction * neighbourRect.height;
    const startY = state.startY + shift;
    drag.current = {
      index: neighbourIndex,
      startY,
      centre: state.centre + shift,
      height: state.height,
    };
    setOffset(event.clientY - startY);
  }

  function onPointerUp() {
    if (!drag.current) return;

    drag.current = null;
    setDraggingId(null);
    setOffset(0);

    const ids = order.map(getId);

    if (ids.join("|") === items.map(getId).join("|")) {
      setOrderIds(null);
      return;
    }

    void settle(ids);
  }

  return (
    <ul className={className}>
      {order.map((item, index) => {
        const id = getId(item);
        const isDragging = id === draggingId;

        return (
          <li
            key={id}
            ref={(node) => {
              rowRefs.current.set(id, node);
            }}
            style={
              isDragging
                ? { transform: `translateY(${offset}px)`, zIndex: 20 }
                : undefined
            }
            className={cn(
              "relative bg-inherit",
              isDragging && "shadow-lg",
              !isDragging && draggingId && "transition-transform",
              itemClassName,
            )}
          >
            {renderItem(item, {
              isDragging,
              handleProps: {
                role: "button",
                tabIndex: disabled ? -1 : 0,
                "aria-disabled": disabled || undefined,
                "aria-label": "Reorder: use the arrow keys or drag",
                style: { touchAction: "none" },
                onPointerDown: (event) =>
                  onPointerDown(
                    event as React.PointerEvent<HTMLElement>,
                    index,
                  ),
                onPointerMove: (event) =>
                  onPointerMove(event as React.PointerEvent<HTMLElement>),
                onPointerUp,
                onPointerCancel: onPointerUp,
                onKeyDown: (event) => {
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    move(index, index - 1);
                  } else if (event.key === "ArrowDown") {
                    event.preventDefault();
                    move(index, index + 1);
                  }
                },
              },
            })}
          </li>
        );
      })}
    </ul>
  );
}

/** The grip itself, 44px wide so a thumb can find it. */
export function DragHandle({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <span
      {...props}
      className={cn(
        "text-text-secondary hoverable:text-text  flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-control active:cursor-grabbing  ",
        className,
      )}
    >
      <GripVertical className="size-4" aria-hidden="true" />
    </span>
  );
}
