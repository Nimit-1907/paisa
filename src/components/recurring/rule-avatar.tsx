import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { cn } from "@/lib/utils";

/**
 * The coloured circle that stands for a rule.
 *
 * A transfer has no category to take a colour or an icon from, so it gets the
 * neutral slate and the two-way arrow instead. That rule was written out in
 * the list and again on the detail page, which is one place too many for a
 * fallback colour to be wrong in.
 */
export function RuleAvatar({
  rule,
  size = "md",
  dimmed = false,
}: {
  rule: {
    type: "income" | "expense" | "transfer";
    categoryIcon: string | null;
    categoryColor: string | null;
  };
  size?: "md" | "lg";
  /** Paused rules sit back a little. */
  dimmed?: boolean;
}) {
  const transfer = rule.type === "transfer";

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-white",
        size === "lg" ? "size-11" : "size-10",
        dimmed && "opacity-50",
      )}
      style={{
        backgroundColor: transfer ? "#64748B" : (rule.categoryColor ?? "#64748B"),
      }}
    >
      <DynamicIcon
        name={transfer ? "ArrowLeftRight" : rule.categoryIcon}
        className={size === "lg" ? "size-5" : "size-[18px]"}
      />
    </span>
  );
}
