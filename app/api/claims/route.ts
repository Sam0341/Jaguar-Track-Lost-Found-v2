import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies, headers } from "next/headers";

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const authHeader = headers().get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  let user = null;

  const supabaseServer = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // ✅ If token present, fetch user from Supabase Auth
  if (token) {
    const { data, error } = await supabaseServer.auth.getUser(token);
    if (error) console.error("Auth error:", error.message);
    user = data?.user;
  }

  // ✅ Fallback to cookie auth
  if (!user) {
    const {
      data: { user: cookieUser },
    } = await supabase.auth.getUser();
    user = cookieUser;
  }

  if (!user)
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { item_id, message } = await req.json();

  const { error: insertError } = await supabase
    .from("claims")
    .insert({
      item_id,
      claimed_by: user.id,
      message,
      status: "Pending",
      created_at: new Date().toISOString(),
    });

  if (insertError) {
    console.error("DB error:", insertError.message);
    return NextResponse.json({ success: false, error: "Database insert failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
