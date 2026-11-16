import {
  ArrowLeftRight,
  Banknote,
  Bike,
  Book,
  Briefcase,
  Bus,
  Car,
  ChartPie,
  Church,
  CircleDollarSign,
  CircleEllipsis,
  Clapperboard,
  Coffee,
  Coins,
  CreditCard,
  Dog,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HandCoins,
  Heart,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  Leaf,
  type LucideIcon,
  Music,
  PawPrint,
  PiggyBank,
  Plane,
  Pizza,
  ReceiptText,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Stethoscope,
  Ticket,
  Train,
  TrendingUp,
  Tv,
  Umbrella,
  UtensilsCrossed,
  Wallet,
  Wifi,
  Wrench,
} from "lucide-react";

/**
 * The icons a user can choose from.
 *
 * A curated subset, not all of lucide: a picker with two thousand icons is
 * unusable on a phone, and a fixed map keeps the bundle to what is listed here
 * instead of pulling the whole library.
 *
 * Icon names are stored as text in the database. Anything unrecognised, an
 * icon dropped from this list later, say, falls back rather than crashing a
 * record list.
 */
export const ICONS = {
  Wallet,
  ArrowLeftRight,
  Banknote,
  Landmark,
  CreditCard,
  PiggyBank,
  Coins,
  CircleDollarSign,
  HandCoins,
  Smartphone,
  TrendingUp,
  Briefcase,
  Laptop,
  UtensilsCrossed,
  Pizza,
  Coffee,
  ShoppingBasket,
  ShoppingBag,
  Shirt,
  House,
  ReceiptText,
  Wifi,
  Tv,
  Bus,
  Train,
  Car,
  Bike,
  Fuel,
  Plane,
  Ticket,
  Clapperboard,
  Music,
  Gamepad2,
  Dumbbell,
  HeartPulse,
  Stethoscope,
  Heart,
  GraduationCap,
  Book,
  Gift,
  Sparkles,
  PawPrint,
  Dog,
  Leaf,
  Umbrella,
  Church,
  Wrench,
  ChartPie,
  CircleEllipsis,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export const ICON_NAMES = Object.keys(ICONS) as IconName[];

/** Sensible starting points for the two pickers. */
export const DEFAULT_ACCOUNT_ICON: IconName = "Wallet";
export const DEFAULT_CATEGORY_ICON: IconName = "ShoppingBag";

/**
 * Resolves a stored name to a component, falling back to a neutral icon.
 *
 * Object.hasOwn, not `in`: `"constructor" in ICONS` is true through the
 * prototype chain, and rendering what that returns is exactly the crash this
 * fallback exists to prevent. Icon names come from the database, so they are
 * as untrusted as any other stored string.
 */
export function resolveIcon(name: string | null | undefined): LucideIcon {
  if (name && Object.hasOwn(ICONS, name)) {
    return ICONS[name as IconName];
  }
  return CircleEllipsis;
}

/** Icons offered first when naming an account of a given type. */
export const ACCOUNT_TYPE_ICONS: Record<string, IconName> = {
  cash: "Wallet",
  bank: "Landmark",
  card: "CreditCard",
  savings: "PiggyBank",
  wallet: "Smartphone",
  other: "Coins",
};
