import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const { data: items, error: itemError } = await supabaseAdmin
      .from("items")
      .select("*")
      .order("reported_at", { ascending: false });

    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*");

    const { data: claims, error: claimError } = await supabaseAdmin
      .from("claims")
      .select("*");

    if (itemError || profileError || claimError) {
      throw itemError || profileError || claimError;
    }

    return NextResponse.json({ success: true, items, profiles, claims });
  } catch (err: any) {
    console.error("Admin fetch failed:", err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
