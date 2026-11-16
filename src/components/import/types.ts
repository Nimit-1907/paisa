import type { Database } from "@/types/database";

export type ImportAccount = {
  id: string;
  name: string;
};

export type ImportCategory = {
  id: string;
  name: string;
  kind: Database["public"]["Enums"]["category_kind"];
  icon: string | null;
  tint: string;
};
