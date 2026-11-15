"use client";

import * as React from "react";

import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Laptop },
] as const;

/**
 * Light / dark / system switch.
 *
 * A segmented control rather than a cycling icon button: all three states are
 * visible, and each segment is a 44px tap target.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // next-themes only knows the resolved theme on the client.
  React.useEffect(() => setMounted(true), []);

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        "bg-surface-muted inline-flex items-center gap-1 rounded-full p-1",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            onClick={() => setTheme(value)}
            className={cn(
              " inline-flex size-11 items-center justify-center rounded-full transition-colors  focus-visible:ring-offset-1 ",
              active
                ? "bg-background text-text shadow-sm"
                : "text-text-secondary hoverable:text-text",
            )}
          >
            <Icon className="size-[18px]" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
