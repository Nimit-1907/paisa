"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import {
  ArrowLeftRight,
  ChartPie,
  Download,
  Info,
  Minus,
  Moon,
  Plus,
  Receipt,
  Repeat,
  Search,
  Settings,
  Sun,
  Tags,
  Target,
  Wallet,
} from "lucide-react";
import { useTheme } from "next-themes";

import { useRecordSheet } from "@/components/records/record-sheet-provider";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";

/**
 * Everything in the app, one keystroke away.
 *
 * ⌘K on a Mac, Ctrl+K elsewhere. It exists because this app has nineteen
 * screens behind five tabs and a More list, and somebody who already knows
 * where they are going should not have to walk the hierarchy to get there.
 *
 * Opened by {@link KeyboardShortcuts}, which holds every global key in one
 * place; this component owns only what the list contains.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const sheet = useRecordSheet();
  const { resolvedTheme, setTheme } = useTheme();

  /** Close first, then act: a sheet opening under a palette is a focus fight. */
  function run(action: () => void) {
    onOpenChange(false);
    action();
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search commands"
      description="Jump to a screen or start something new."
    >
      <CommandInput placeholder="Jump to, or start something…" />
      <CommandList>
        <CommandEmpty>Nothing matches that.</CommandEmpty>

        <CommandGroup heading="Add">
          <CommandItem
            // Searchable by the word somebody is thinking of, not only the
            // word on the label: "spend" and "cost" both find this.
            keywords={["expense", "spend", "cost", "new", "record"]}
            onSelect={() => run(() => sheet.openAdd("expense"))}
          >
            <Minus aria-hidden="true" />
            Add an expense
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem
            keywords={["income", "salary", "earned", "received"]}
            onSelect={() => run(() => sheet.openAdd("income"))}
          >
            <Plus aria-hidden="true" />
            Add income
          </CommandItem>
          <CommandItem
            keywords={["transfer", "move", "between accounts"]}
            onSelect={() => run(() => sheet.openAdd("transfer"))}
          >
            <ArrowLeftRight aria-hidden="true" />
            Transfer between accounts
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Go to">
          {[
            { href: "/records", label: "Records", icon: Receipt },
            { href: "/analysis", label: "Analysis", icon: ChartPie },
            { href: "/budgets", label: "Budgets", icon: Target },
            { href: "/accounts", label: "Accounts", icon: Wallet },
            { href: "/categories", label: "Categories", icon: Tags },
            { href: "/recurring", label: "Recurring", icon: Repeat },
            { href: "/export", label: "Export", icon: Download },
            { href: "/settings", label: "Settings", icon: Settings },
            { href: "/about", label: "About", icon: Info },
          ].map((item) => (
            <CommandItem
              key={item.href}
              onSelect={() => run(() => router.push(item.href))}
            >
              <item.icon aria-hidden="true" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Do">
          <CommandItem
            keywords={["search", "find", "look up"]}
            onSelect={() => run(() => router.push("/records?search=1"))}
          >
            <Search aria-hidden="true" />
            Search your records
            <CommandShortcut>/</CommandShortcut>
          </CommandItem>
          <CommandItem
            keywords={["theme", "dark", "light", "appearance"]}
            onSelect={() =>
              run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))
            }
          >
            {resolvedTheme === "dark" ? (
              <Sun aria-hidden="true" />
            ) : (
              <Moon aria-hidden="true" />
            )}
            Switch to {resolvedTheme === "dark" ? "light" : "dark"} mode
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
