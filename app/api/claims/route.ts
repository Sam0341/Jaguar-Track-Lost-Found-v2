import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

/**
 * Dev bypass helper
 * Allows localhost or requests with x-dev-admin header to skip auth
 */
function isDevBypass(req: Request) {
  const origin = req.headers.get("origin") || req.headers.get("referer") || "";
  const host = req.headers.get("host") || "";
  const headerSecret = req.headers.get("x-dev-admin") || "";

  const devEnv = process.env.NODE_ENV !== "production";
  const originIsLocal =
    origin.includes("localhost") ||
    origin.includes("127.0.0.1") ||
    host.includes("localhost") ||
    host.includes("127.0.0.1");

  const secretOk =
    headerSecret &&
    process.env.DEV_ADMIN_SECRET &&
    headerSecret === process.env.DEV_ADMIN_SECRET;

  return (devEnv && originIsLocal) || secretOk;
}

/**
 * ✅ GET /api/claims
 * Fetch all claims (admin)
 */
export async function GET(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    // 🔐 Allow dev bypass
    if (userError || !user) {
      if (!isDevBypass(req)) {
        return NextResponse.json(
          { success: false, error: "Unauthorized – no valid session" },
          { status: 401 }
        );
      } else {
        console.warn("⚠️ Dev bypass used for GET /api/claims");
      }
    }

    // 🧾 Simplified query (no joins)
    const { data, error } = await supabase
      .from("claims")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Claim fetch error:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
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
 * Create a new claim
 */
export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    let devBypassed = false;
    if (userError || !user) {
      if (!isDevBypass(req)) {
        return NextResponse.json(
          { success: false, error: "Unauthorized – no valid session" },
          { status: 401 }
        );
      } else {
        devBypassed = true;
        console.warn("⚠️ Dev bypass used for POST /api/claims");
      }
    }

    const { item_id, message } = await req.json();

    if (!item_id) {
      return NextResponse.json(
        { success: false, error: "Missing item_id" },
        { status: 400 }
      );
    }

    const claimedBy = devBypassed
      ? process.env.DEV_ADMIN_ID || null
      : user?.id || null;

    const { error: insertError } = await supabase.from("claims").insert([
      {
        item_id,
        claimed_by: claimedBy,
        message: message || "",
        status: "pending",
      },
    ]);

    if (insertError) {
      console.error("Claim insert error:", insertError);
      return NextResponse.json({ success: false, error: insertError.message }, { status: 400 });
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
 * Approve or reject a claim (admin)
 */
export async function PATCH(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    let devBypassed = false;
    if (userError || !user) {
      if (!isDevBypass(req)) {
        return NextResponse.json(
          { success: false, error: "Unauthorized – no valid session" },
          { status: 401 }
        );
      } else {
        devBypassed = true;
        console.warn("⚠️ Dev bypass used for PATCH /api/claims");
      }
    }

    const { claim_id, status } = await req.json();

    if (!claim_id || !status) {
      return NextResponse.json(
        { success: false, error: "Missing claim_id or status" },
        { status: 400 }
      );
    }

    const normalizedStatus = String(status).toLowerCase();

    // Update claim status
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

    // If approved, mark the item as claimed
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
