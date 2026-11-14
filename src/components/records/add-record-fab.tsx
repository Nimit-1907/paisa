"use client";

import { Plus } from "lucide-react";

import { useRecordSheet } from "@/components/records/record-sheet-provider";

/**
 * Floating "+" button, reachable from every main tab.
 *
 * Sits above the bottom bar and the iOS home bar on phones; bottom-right of
 * the content area from `lg` up, where there is no bottom bar. The sheet it
 * opens lives in the layout, so the Records screen can take over saving and
 * show the new row before the server answers.
 */
export function AddRecordFab() {
  const sheet = useRecordSheet();

  return (
    <button
      type="button"
      onClick={sheet.openAdd}
      aria-label="Add record"
      className="bg-primary text-primary-foreground focus-visible:ring-ring fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex size-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none lg:right-8 lg:bottom-8"
    >
      <Plus className="size-7" aria-hidden="true" />
    </button>
  );
}
