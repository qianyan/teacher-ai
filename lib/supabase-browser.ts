import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function getSupabaseBrowserClient() {
  return createSupabaseBrowserClient();
}
