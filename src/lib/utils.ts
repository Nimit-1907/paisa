import { createCn } from "cn/config";

/**
 * `cn`, taught about this project's one custom type-scale step.
 *
 * tailwind-merge decides which of two conflicting classes wins by looking the
 * class up in a table of groups. `text-label` is not in that table, so it was
 * read as a text *colour* — and in the bottom nav, where the label size and
 * the active colour arrive together, `text-primary` quietly deleted it and
 * the tab labels rendered at 16px, wide enough to collide at 320px.
 *
 * Registering it as a font-size is the fix. Anything else added to
 * `--text-*` in globals.css has to be added here too.
 */
export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: ["label"] }] } },
});
