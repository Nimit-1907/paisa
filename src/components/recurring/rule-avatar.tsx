import { cn } from "@/lib/utils";
import { ColorDot } from "@/components/shared/color-dot";

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
    <ColorDot
      className={cn(dimmed && "opacity-50")}
      size={size}
      color={transfer ? null : rule.categoryColor}
      icon={transfer ? "ArrowLeftRight" : rule.categoryIcon}
    />
  );
}
