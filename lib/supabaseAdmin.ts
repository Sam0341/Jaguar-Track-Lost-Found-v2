import { createClient } from "@supabase/supabase-js";

// ⚠️ Never expose this key on the client
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!, // this is your secret Service Role Key
  {
    auth: { persistSession: false },
  }
);
