import { supabase } from "./supabaseClient";

export async function addLog(action: string, item_id: string, user_id: string | null) {
  await supabase.from("logs").insert([
    {
      action,
      item_id,
      performed_by: user_id,
    },
  ]);
}
