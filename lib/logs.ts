import { supabase } from "@/lib/supabaseClient";

export async function addLog(action: string, itemId: string, performedBy: string) {
  await supabase.from("logs").insert([
    {
      action,
      item_id: itemId,
      performed_by: performedBy,
    },
  ]);
}
