import {
  ChartPie,
  Download,
  Ellipsis,
  Info,
  type LucideIcon,
  Receipt,
  Repeat,
  Settings,
  Tags,
  Target,
  Upload,
  Wallet,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Also treat these path prefixes as "this tab is active". */
  owns?: string[];
};

/** The five bottom tabs (mobile) / sidebar links (>= lg). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/records", label: "Records", icon: Receipt },
  { href: "/analysis", label: "Analysis", icon: ChartPie },
  { href: "/budgets", label: "Budgets", icon: Target },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  {
    href: "/more",
    label: "More",
    icon: Ellipsis,
    owns: [
      "/about",
      "/categories",
      "/export",
      "/import",
      "/recurring",
      "/settings",
    ],
  },
];

/** Secondary destinations, listed on the More tab. */
export const MORE_ITEMS = [
  {
    href: "/recurring",
    label: "Recurring",
    description: "Rent, salary and subscriptions that repeat",
    icon: Repeat,
  },
  {
    href: "/categories",
    label: "Categories",
    description: "Rename, re-colour and reorder your categories",
    icon: Tags,
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Name, currency, week start, theme and password",
    icon: Settings,
  },
  {
    href: "/import",
    label: "Import",
    description: "Bring in records from a bank or another app's CSV",
    icon: Upload,
  },
  {
    href: "/export",
    label: "Export",
    description: "Download your records as CSV or a monthly PDF",
    icon: Download,
  },
  {
    href: "/about",
    label: "About",
    description: "What this is, and what it keeps",
    icon: Info,
  },
] as const;

/** True for the route itself and anything nested under it. */
export function isPathActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Whether a tab should be highlighted.
 *
 * `includeOwned` is what keeps the two navs honest: the bottom bar has no
 * Categories/Settings tab, so More stands in for them, while the sidebar lists
 * them separately and would otherwise highlight two entries at once.
 */
export function isNavItemActive(
  item: NavItem,
  pathname: string,
  { includeOwned = true }: { includeOwned?: boolean } = {},
): boolean {
  const paths = includeOwned ? [item.href, ...(item.owns ?? [])] : [item.href];
  return paths.some((path) => isPathActive(path, pathname));
}
