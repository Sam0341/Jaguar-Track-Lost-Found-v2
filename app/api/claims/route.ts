import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Dev bypass helper (for localhost or x-dev-admin header)
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
 * Create a Supabase admin client (service key)
 */
function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * ✅ GET /api/claims - Fetch all claims (admin)
 */
export async function GET(req: Request) {
  try {
    const cookieClient = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: userError,
    } = await cookieClient.auth.getUser();

    // 🔐 Use service key if no valid session (on Vercel)
    const isBypass = isDevBypass(req);
    const supabase = !user && !isBypass ? createAdminClient() : cookieClient;

    const { data, error } = await supabase
      .from("claims")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (err: any) {
    console.error("🔥 GET /claims error:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * ✅ POST /api/claims - Create a new claim
 */
export async function POST(req: Request) {
  try {
    const cookieClient = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: userError,
    } = await cookieClient.auth.getUser();

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
    if (!item_id)
      return NextResponse.json(
        { success: false, error: "Missing item_id" },
        { status: 400 }
      );

    const claimedBy = devBypassed
      ? process.env.DEV_ADMIN_ID || null
      : user?.id || null;

    const supabase = devBypassed ? createAdminClient() : cookieClient;

    const { error } = await supabase.from("claims").insert([
      {
        item_id,
        claimed_by: claimedBy,
        message: message || "",
        status: "pending",
      },
    ]);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Claim submitted successfully.",
    });
  } catch (err: any) {
    console.error("🔥 POST /claims error:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * ✅ PATCH /api/claims - Approve or reject a claim (admin)
 */
export async function PATCH(req: Request) {
  try {
    const cookieClient = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: userError,
    } = await cookieClient.auth.getUser();

    const { claim_id, status } = await req.json();
    if (!claim_id || !status)
      return NextResponse.json(
        { success: false, error: "Missing claim_id or status" },
        { status: 400 }
      );

    const normalizedStatus = String(status).toLowerCase();
    const isBypass = isDevBypass(req);
    const supabase = !user && !isBypass ? createAdminClient() : cookieClient;

    // Update claim
    const { error: updateError } = await supabase
      .from("claims")
      .update({ status: normalizedStatus })
      .eq("id", claim_id);

    if (updateError) throw updateError;

    // If approved, also mark related item as "Claimed"
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
  } catch (err: any) {
    console.error("🔥 PATCH /claims error:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
