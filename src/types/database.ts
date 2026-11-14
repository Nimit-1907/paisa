/**
 * Supabase schema types.
 *
 * PLACEHOLDER — Phase 1 has no tables yet. From Phase 2 on, this file is
 * generated and must never be edited by hand:
 *
 *   npm run db:types
 *   (= supabase gen types typescript --local > src/types/database.ts)
 *
 * Run it after every migration.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<never, never>;
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
