import { resolveIcon } from "@/lib/icons";

/**
 * Renders an icon by the name stored on an account or category.
 *
 * Works in Server and Client Components alike, and falls back to a neutral
 * glyph for a name that is no longer in the picker — a dropped icon should
 * not take a record list down with it.
 */
export function DynamicIcon({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  const Icon = resolveIcon(name);
  return <Icon className={className} aria-hidden="true" />;
}
