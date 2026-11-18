import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { DEMO_EMAIL, DEMO_PASSWORD } from "./sign-in";

/**
 * Removes what a test left on the demo account when it stopped half way.
 *
 * A suite that deletes its own data in its last steps leaves it behind the
 * moment an earlier step fails, and the demo account is the one people look
 * at. This signs in as the demo user, so row level security still decides
 * what it can touch, and deletes rows whose name starts with the prefix.
 */
function env(name: string): string | undefined {
  if (process.env[name]) return process.env[name];

  try {
    const file = fs.readFileSync(
      path.join(process.cwd(), ".env.local"),
      "utf8",
    );
    const line = file.split("\n").find((row) => row.startsWith(`${name}=`));
    return line?.slice(name.length + 1).trim();
  } catch {
    return undefined;
  }
}

export async function deleteDemoRowsNamed(
  prefix: string,
  tables: ("investments" | "investment_goals")[],
) {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !key) {
    throw new Error(
      "cleanup: no Supabase URL or anon key in env or .env.local",
    );
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });
  const { error } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (error) throw new Error(`cleanup: demo sign-in failed: ${error.message}`);

  for (const table of tables) {
    const result = await supabase
      .from(table)
      .delete()
      .like("name", `${prefix}%`);
    if (result.error) {
      throw new Error(
        `cleanup: deleting from ${table} failed: ${result.error.message}`,
      );
    }
  }
  await supabase.auth.signOut();
}
