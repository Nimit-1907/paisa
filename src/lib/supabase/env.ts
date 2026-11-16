/**
 * Reads the public Supabase env vars and fails loudly (and early) when the
 * project has not been configured yet, a missing key otherwise shows up as a
 * confusing "Invalid API key" at request time.
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Run `supabase start` and copy the printed values into .env.local " +
        "(see .env.example).",
    );
  }

  return { url, anonKey };
}
