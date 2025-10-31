import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });

  // 🧠 Get user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 🧠 Check role from profiles
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ✅ Fetch claims joined with items + claimant info
  const { data, error } = await supabase
    .from("claims")
    .select(`
      id,
      message,
      status,
      created_at,
      items ( name, campus, category ),
      profiles!claims_claimed_by_fkey ( email )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching claims:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ claims: data });
}
