import { getGlobalMemoryStore } from "./memory-store";
import { supabaseServerConfigured } from "./env";
import type { RoleplayStore } from "./store";
import { createSupabaseStore } from "./supabase-store";

export function getRoleplayStore(): RoleplayStore {
  if (supabaseServerConfigured()) {
    return createSupabaseStore();
  }
  return getGlobalMemoryStore();
}
