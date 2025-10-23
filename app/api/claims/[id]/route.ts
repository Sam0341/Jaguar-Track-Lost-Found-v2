import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // ✅ Ensure authenticated user (middleware provides cookies)
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("❌ Auth error:", userError);
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // ✅ Parse body
    const { status } = await req.json();
    if (!status) {
      return NextResponse.json({ success: false, error: "Missing status" }, { status: 400 });
    }

    // ✅ Verify admin role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Profile lookup error:", profileError);
      return NextResponse.json({ success: false, error: "Error checking profile" }, { status: 500 });
    }

    if (profile?.role !== "admin") {
      return NextResponse.json({ success: false, error: "Permission denied" }, { status: 403 });
    }

    // ✅ Fetch the claim
    const { data: claim, error: claimError } = await supabase
      .from("claims")
      .select("item_id")
      .eq("id", params.id)
      .maybeSingle();

    if (claimError || !claim) {
      return NextResponse.json({ success: false, error: "Claim not found" }, { status: 404 });
    }

    // ✅ Update claim record
    const { error: updateError } = await supabase
      .from("claims")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id);

    if (updateError) {
      console.error("Claim update error:", updateError);
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    // ✅ If approved, update the related item
    if (status === "Approved") {
      const { error: itemError } = await supabase
        .from("items")
        .update({
          status: "Claimed",
          claimed_by: user.id,
        })
        .eq("id", claim.item_id);

      if (itemError) {
        console.error("Item update error:", itemError);
        return NextResponse.json({ success: false, error: itemError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Claim successfully updated to "${status}"`,
    });
  } catch (err: any) {
    console.error("Unexpected error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
