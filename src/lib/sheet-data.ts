/**
 * The Add Record sheet's pickers, as the (app) layout streams them.
 *
 * Its own module rather than record-sheet-provider.tsx: that one is a
 * client module, and a plain value imported from one into a Server
 * Component arrives as a client reference, not the object.
 */
import type {
  AccountOption,
  CategoryOption,
} from "@/components/shared/entry-pickers";
import type { EntryDefaults, QuickAdd } from "@/lib/queries/accounts";

/** What the sheet's pickers need, loaded once by the (app) layout. */
export type SheetData = {
  accounts: AccountOption[];
  categories: CategoryOption[];
  entryDefaults: EntryDefaults;
  /** The things this person buys over and over, as one-tap chips. */
  quickAdds: QuickAdd[];
  /** Notes written before, offered as you type. */
  noteHints: string[];
  /** False when the balance lookup failed, so the sheet can say so. */
  balancesKnown: boolean;
  /** True when none of it could be loaded: Add says so and offers a retry. */
  failed?: boolean;
};

/** What the sheet has when its data could not be loaded: nothing to pick. */
export const EMPTY_SHEET_DATA: SheetData = {
  accounts: [],
  categories: [],
  entryDefaults: { suggestedCategoryIds: [], partOfDay: "night" },
  quickAdds: [],
  noteHints: [],
  balancesKnown: false,
};
