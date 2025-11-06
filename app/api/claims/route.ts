import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/* ----------------------------------------------------------
 * 🧠 Utility: Dev Bypass Helper
 * ---------------------------------------------------------- */
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

/* ----------------------------------------------------------
 * 🧠 Utility: Create Admin Supabase Client (Service Key)
 * ---------------------------------------------------------- */
function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { persistSession: false } }
  );
}

/* ----------------------------------------------------------
 * 🧠 Utility: Get Supabase User from Authorization Header
 * ---------------------------------------------------------- */
async function getSupabaseUserFromToken(req: Request) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
  if (!token) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return { ...data.user, access_token: token };
}

/* ==========================================================
 * ✅ GET /api/claims → Fetch all claims (Admin)
 * ========================================================== */
export async function GET(req: Request) {
  try {
    const cookieClient = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: userError,
    } = await cookieClient.auth.getUser();

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

/* ==========================================================
 * ✅ POST /api/claims → Submit a new claim (User)
 * ========================================================== */
export async function POST(req: Request) {
  try {
    // Try header-based token first
    let user = await getSupabaseUserFromToken(req);

    // Fallback: get from cookies
    const cookieClient = createRouteHandlerClient({ cookies });
    if (!user) {
      const { data, error } = await cookieClient.auth.getUser();
      user = data?.user;
      if (error || !user) {
        return NextResponse.json(
          { success: false, error: "Unauthorized – no valid session" },
          { status: 401 }
        );
      }
    }

    const { item_id, message } = await req.json();
    if (!item_id) {
      return NextResponse.json(
        { success: false, error: "Missing item_id" },
        { status: 400 }
      );
    }

    // ✅ Create a Supabase client with user's auth token (so RLS works)
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${user.access_token}`,
          },
        },
      }
    );

    // ✅ Insert claim with RLS context
    const { error } = await userClient.from("claims").insert([
      {
        item_id,
        claimed_by: user.id,
        message: message || "",
        status: "pending",
      },
    ]);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Claim submitted successfully!",
    });
  } catch (err: any) {
    console.error("🔥 POST /claims error:", err.message);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/* ==========================================================
 * ✅ PATCH /api/claims → Approve or reject a claim (Admin)
 * ========================================================== */
export async function PATCH(req: Request) {
  try {
    const cookieClient = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: userError,
    } = await cookieClient.auth.getUser();

    const isBypass = isDevBypass(req);
    const supabase = !user && !isBypass ? createAdminClient() : cookieClient;

    const { claim_id, status } = await req.json();
    if (!claim_id || !status)
      return NextResponse.json(
        { success: false, error: "Missing claim_id or status" },
        { status: 400 }
      );

    const normalizedStatus = String(status).toLowerCase();

    // Update claim status
    const { error: updateError } = await supabase
      .from("claims")
      .update({ status: normalizedStatus })
      .eq("id", claim_id);

    if (updateError) throw updateError;

    // If approved, mark related item as "Claimed"
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
