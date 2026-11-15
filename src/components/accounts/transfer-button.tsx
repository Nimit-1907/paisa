"use client";

import { ArrowLeftRight } from "lucide-react";

import { useRecordSheet } from "@/components/records/record-sheet-provider";
import { Button } from "@/components/ui/button";

/**
 * "Transfer", in the Accounts header.
 *
 * Moving money between your own accounts is the one thing you come to this
 * screen to *do*, and until now it was four taps away through the FAB and
 * the Transfer tab. This is the same sheet, opened on the right tab.
 *
 * Hidden until there is somewhere to move money to. A transfer needs two
 * accounts, and a button that can only ever fail is worse than no button.
 */
export function TransferButton({ accountCount }: { accountCount: number }) {
  const sheet = useRecordSheet();

  if (accountCount < 2) return null;

  return (
    // An icon on a phone, where the header row also carries the title,
    // search and the profile; the word comes back once there is room. The
    // accessible name is the same either way.
    <Button
      variant="ghost"
      size="touch"
      className="w-11 px-0 sm:w-auto sm:px-3"
      aria-label="Transfer"
      onClick={() => sheet.openAdd("transfer")}
    >
      <ArrowLeftRight className="size-5 sm:size-4" aria-hidden="true" />
      <span className="hidden sm:inline">Transfer</span>
    </Button>
  );
}
