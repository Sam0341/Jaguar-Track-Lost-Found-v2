import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

/**
 * ✅ GET /api/claims
 * Fetch all claims for admin view
 */
export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // 🔐 Check for an active user session
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized – no valid session" },
        { status: 401 }
      );
    }

    // 🧾 Try fetching with relationships first
    let { data, error } = await supabase
      .from("claims")
      .select(`
        id,
        item_id,
        message,
        status,
        created_at,
        claimed_by ( email ),
        items ( name, campus, status )
      `)
      .order("created_at", { ascending: false });

    // 🩹 Fallback if relationships not set in Supabase
    if (error) {
      console.warn("Join fetch failed, falling back to basic query:", error.message);
      const basic = await supabase
        .from("claims")
        .select("*")
        .order("created_at", { ascending: false });
      data = basic.data;
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error("🔥 Unexpected error in GET /claims:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * ✅ POST /api/claims
 * Create a new claim (used by users)
 */
export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized – no valid session" },
        { status: 401 }
      );
    }

    const { item_id, message } = await req.json();

    if (!item_id) {
      return NextResponse.json(
        { success: false, error: "Missing item_id" },
        { status: 400 }
      );
    }

    const { error: insertError } = await supabase.from("claims").insert([
      {
        item_id,
        claimed_by: user.id,
        message: message || "",
        status: "pending",
      },
    ]);

    if (insertError) {
      console.error("Claim insert error:", insertError);
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Claim submitted successfully.",
    });
  } catch (err) {
    console.error("🔥 Unexpected error in POST /claims:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * ✅ PATCH /api/claims
 * Approve or reject a claim (used by admin)
 */
export async function PATCH(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized – no valid session" },
        { status: 401 }
      );
    }

    const { claim_id, status } = await req.json();

    if (!claim_id || !["Approved", "Rejected", "approved", "rejected"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid claim_id or status" },
        { status: 400 }
      );
    }

    // Normalize status casing
    const normalizedStatus = status.toLowerCase();

    // 🧾 Update claim status
    const { error: updateError } = await supabase
      .from("claims")
      .update({ status: normalizedStatus })
      .eq("id", claim_id);

    if (updateError) {
      console.error("Claim update error:", updateError);
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 400 }
      );
    }

    // ✅ If approved, update the related item to "Claimed"
    if (normalizedStatus === "approved") {
      const { data: claimData } = await supabase
        .from("claims")
        .select("item_id")
        .eq("id", claim_id)
        .single();

      if (claimData?.item_id) {
        await supabase
          .from("items")
          .update({ status: "Claimed" })
          .eq("id", claimData.item_id);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Claim ${normalizedStatus} successfully!`,
    });
  } catch (err) {
    console.error("🔥 PATCH /claims error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
