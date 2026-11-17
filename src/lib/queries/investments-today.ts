import "server-only";

import { DEFAULT_TIME_ZONE } from "@/lib/month-param";
import { getProfile } from "@/lib/profile";
import { localToday } from "@/lib/recurring-check";

/** Today in the user's own time zone, which every investments screen needs. */
export async function investmentsToday(): Promise<string> {
  const profile = await getProfile();
  return localToday(profile?.timezone ?? DEFAULT_TIME_ZONE);
}
