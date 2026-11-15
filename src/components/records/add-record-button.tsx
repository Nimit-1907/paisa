"use client";

import { Plus } from "lucide-react";

import { useRecordSheet } from "@/components/records/record-sheet-provider";
import { Button } from "@/components/ui/button";

/**
 * "Add record", as a button rather than the floating one.
 *
 * For empty states: a screen with nothing on it should say what to do next
 * in one button, and pointing at the floating "+" in a sentence is a worse
 * version of putting the button where the person is already looking.
 */
export function AddRecordButton({ label = "Add record" }: { label?: string }) {
  const sheet = useRecordSheet();

  return (
    <Button size="touch" onClick={() => sheet.openAdd()}>
      <Plus className="size-4" aria-hidden="true" />
      {label}
    </Button>
  );
}
