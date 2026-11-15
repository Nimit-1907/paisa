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
    <Button
      variant="outline"
      size="touch"
      className="px-3"
      onClick={() => sheet.openAdd("transfer")}
    >
      <ArrowLeftRight className="size-4" aria-hidden="true" />
      Transfer
    </Button>
  );
}
